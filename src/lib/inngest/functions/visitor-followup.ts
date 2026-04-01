import { NonRetriableError } from "inngest";
import { and, desc, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  aiConfig,
  appointments,
  churchContacts,
  conversations,
  graceFollowupProposals,
  messages,
  tasks,
} from "@/db/schema";
import sendMail from "@/lib/email/sendMail";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

const VISITOR_STATUSES = new Set(["visitor", "prospect"]);

type FollowupContext = {
  organizationId: string;
  contactId: string;
  conversationId: string;
  sessionId: string;
  churchName: string;
  contactName: string;
  recipient: string | null;
  channel: "sms" | "email";
  sequenceStartedAt: string;
};

function trimOrNull(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export const visitorFollowupSequence = inngest.createFunction(
  {
    id: "sequence-visitor-followup",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.CONTACT_CREATED },
  async ({ event, step, logger }) => {
    const { organizationId, contactId } = event.data;

    const context = await step.run("prepare-context", async () => {
      const [contact] = await db
        .select()
        .from(churchContacts)
        .where(and(eq(churchContacts.organizationId, organizationId), eq(churchContacts.id, contactId)))
        .limit(1);

      if (!contact) {
        throw new NonRetriableError(`Contact not found: ${contactId}`);
      }

      if (!VISITOR_STATUSES.has(contact.memberStatus)) {
        return {
          skip: true,
          reason: `Contact status ${contact.memberStatus} not eligible for visitor follow-up`,
        } as const;
      }

      const phone = trimOrNull(contact.phone);
      const email = trimOrNull(contact.email);
      if (!phone && !email) {
        return {
          skip: true,
          reason: "Contact has no phone or email for follow-up",
        } as const;
      }

      const [orgConfig] = await db
        .select({ churchName: aiConfig.churchName })
        .from(aiConfig)
        .where(eq(aiConfig.organizationId, organizationId))
        .limit(1);

      const channel: "sms" | "email" = phone ? "sms" : "email";
      const recipient = channel === "sms" ? phone : email;
      const churchName = trimOrNull(orgConfig?.churchName) ?? "your church";
      const contactName = `${contact.firstName} ${contact.lastName}`.trim();
      const session = await getOrCreateGraceSession({
        organizationId,
        channel: channel === "sms" ? "sms" : "web",
        actorType: "system",
        contactId: contact.id,
      });

      const [existingConversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, organizationId),
            eq(conversations.contactId, contact.id),
            eq(conversations.channel, channel)
          )
        )
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
        .limit(1);

      const conversationId =
        existingConversation?.id ??
        (
          await db
            .insert(conversations)
            .values({
              organizationId,
              contactId: contact.id,
              channel,
              status: "open",
              subject: "Visitor Follow-Up Sequence",
            })
            .returning({ id: conversations.id })
        )[0].id;

      return {
        skip: false,
        context: {
          organizationId,
          contactId: contact.id,
          conversationId,
          sessionId: session.id,
          churchName,
          contactName,
          recipient,
          channel,
          sequenceStartedAt: new Date().toISOString(),
        } satisfies FollowupContext,
      } as const;
    });

    if (context.skip) {
      logger.info("Visitor follow-up skipped", { organizationId, contactId, reason: context.reason });
      return { status: "skipped", reason: context.reason };
    }

    const run = context.context;
    const firstMessage = `Hi ${run.contactName.split(" ")[0] || "there"}, this is Grace from ${run.churchName}. We are glad you connected with us. Would you like prayer, service times, or help planning your next visit?`;
    const secondMessage = `Just checking in from ${run.churchName}. I can help you get connected, request prayer, or book time with a pastor. Reply any time and I will route it.`;

    const sendFollowupMessage = async (messageText: string, reason: string, stepName: string) =>
      step.run(stepName, async () => {
        await db.insert(messages).values({
          conversationId: run.conversationId,
          content: messageText,
          direction: "outbound",
          senderType: "ai",
        });

        await db
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, run.conversationId));

        let deliveryStatus: "sent" | "pending" = "pending";
        let deliveryError: string | null = null;

        if (run.channel === "sms" && run.recipient) {
          try {
            const sendResult = await sendOrganizationSms({
              organizationId: run.organizationId,
              to: run.recipient,
              message: messageText,
              idempotencyKey: `visitor-followup:${run.sessionId}:${reason}`,
            });
            if (!sendResult.success) {
              throw new Error(sendResult.error ?? "SMS delivery failed");
            }
            deliveryStatus = "sent";
          } catch (error) {
            deliveryStatus = "pending";
            deliveryError = error instanceof Error ? error.message : "SMS delivery failed";
          }
        } else if (run.channel === "email" && run.recipient) {
          try {
            await sendMail(run.recipient, `Welcome to ${run.churchName}`, messageText);
            deliveryStatus = "sent";
          } catch (error) {
            deliveryStatus = "pending";
            deliveryError = error instanceof Error ? error.message : "Email delivery failed";
          }
        }

        await db.insert(graceFollowupProposals).values({
          organizationId: run.organizationId,
          sessionId: run.sessionId,
          contactId: run.contactId,
          actorType: "system",
          channel: run.channel,
          proposedChannel: run.channel,
          recipient: run.recipient,
          subject: run.channel === "email" ? `Follow-up from ${run.churchName}` : null,
          messageText,
          reason,
          status: deliveryStatus,
          metadataJson: {
            sequence: "visitor_follow_up",
            step: reason,
            deliveryError,
          },
        });

        return { deliveryStatus, deliveryError };
      });

    const hasStopSignal = async (stepName: string) =>
      step.run(stepName, async () => {
        const since = new Date(run.sequenceStartedAt);

        const [inboundReply] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, run.conversationId),
              eq(messages.direction, "inbound"),
              gte(messages.sentAt, since)
            )
          )
          .limit(1);

        const [bookedAppointment] = await db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, run.organizationId),
              eq(appointments.contactId, run.contactId),
              gte(appointments.createdAt, since),
              ne(appointments.status, "cancelled"),
              ne(appointments.status, "no_show")
            )
          )
          .limit(1);

        return Boolean(inboundReply || bookedAppointment);
      });

    await sendFollowupMessage(firstMessage, "step_1_immediate_welcome", "send-immediate-followup");

    await step.sleep("wait-24h", "24h");
    if (await hasStopSignal("check-stop-signal-after-24h")) {
      return { status: "stopped", reason: "member_engaged_after_first_followup" };
    }

    await sendFollowupMessage(secondMessage, "step_2_check_in", "send-second-followup");

    await step.sleep("wait-72h", "72h");
    if (await hasStopSignal("check-stop-signal-after-96h")) {
      return { status: "stopped", reason: "member_engaged_after_second_followup" };
    }

    await step.run("create-escalation-task", async () => {
      const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const [task] = await db
        .insert(tasks)
        .values({
          organizationId: run.organizationId,
          title: `Visitor follow-up required: ${run.contactName}`,
          description:
            "No response after automated visitor follow-up sequence. Please call or send a personal outreach message.",
          priority: "high",
          status: "todo",
          dueDate,
        })
        .returning({ id: tasks.id });

      await db.insert(graceFollowupProposals).values({
        organizationId: run.organizationId,
        sessionId: run.sessionId,
        contactId: run.contactId,
        actorType: "system",
        channel: run.channel,
        proposedChannel: run.channel,
        recipient: run.recipient,
        subject: "Manual follow-up escalation",
        messageText: "Grace created a manual outreach task because the visitor sequence received no response.",
        reason: "step_3_manual_escalation",
        status: "pending",
        metadataJson: {
          sequence: "visitor_follow_up",
          taskId: task.id,
          step: "manual_escalation",
        },
      });
    });

    return { status: "completed", sequence: "visitor_follow_up" };
  }
);
