import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { broadcasts, churchContacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import sendMail from "@/lib/email/sendMail";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

/**
 * Send SMS batch via the org-aware SMS gateway.
 * Resolves the org's assigned Android device server-side.
 */
async function sendSmsBatch(organizationId: string, recipients: string[], message: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/sms-gateway/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.SMS_GATEWAY_API_KEY || "",
    },
    body: JSON.stringify({ organizationId, recipients, message }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS gateway error: ${response.status} - ${text}`);
  }
  return response.json();
}

// Android default security limit is ~30 per 30 mins. 
// We will send batches of 15, then sleep for 16 minutes to be extremely safe.
const BATCH_SIZE = 15;
const SLEEP_DURATION = "16m"; 
const EMAIL_BATCH_SIZE = 50;

function parseAudienceFilter(input: unknown) {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return typeof input === "object" ? (input as Record<string, unknown>) : {};
}

export const sendBroadcast = inngest.createFunction(
  {
    id: "send-broadcast",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.COMMUNICATIONS_BROADCAST_SEND_REQUESTED },
  async ({ event, step, logger }) => {
    const { broadcastId, organizationId } = event.data;

    const broadcast = await step.run("fetch-broadcast", async () => {
      const result = await db
        .select()
        .from(broadcasts)
        .where(and(eq(broadcasts.id, broadcastId), eq(broadcasts.organizationId, organizationId)))
        .limit(1);
      if (result.length === 0) {
        throw new NonRetriableError("Broadcast not found for organization");
      }
      
      // Update status to sending
      await db.update(broadcasts)
        .set({ status: 'sending' })
        .where(eq(broadcasts.id, broadcastId));

      return result[0];
    });

    const audience = await step.run("fetch-audience", async () => {
      const audienceFilter = parseAudienceFilter(broadcast.audienceFilter);
      const statusFilter = typeof audienceFilter.status === "string" ? audienceFilter.status : null;

      const allContacts = await db.select().from(churchContacts).where(
        statusFilter
          ? and(
              eq(churchContacts.organizationId, broadcast.organizationId),
              eq(churchContacts.memberStatus, statusFilter as typeof churchContacts.$inferSelect.memberStatus)
            )
          : eq(churchContacts.organizationId, broadcast.organizationId)
      );

      if (broadcast.channel === "sms") {
        return allContacts.filter((c) => c.phone && c.phone.length > 9);
      }
      if (broadcast.channel === "email") {
        return allContacts.filter((c) => c.email && c.email.includes("@"));
      }
      return [];
    });

    if (broadcast.channel === "sms") {
      logger.info(`Sending TextBee broadcast to ${audience.length} recipients...`);

      // Chunk the audience into safe Android batches
      const batches = [];
      for (let i = 0; i < audience.length; i += BATCH_SIZE) {
        batches.push(audience.slice(i, i + BATCH_SIZE));
      }

      let totalDelivered = 0;
      let totalFailed = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const phoneNumbers = batch.map((c) => c.phone as string);

        await step.run(`send-batch-${i}`, async () => {
          try {
            await sendSmsBatch(organizationId, phoneNumbers, broadcast.content || "");
            totalDelivered += batch.length;
          } catch (error) {
            totalFailed += batch.length;
            logger.error("SMS batch failed", { batchIndex: i, error });
          }
        });

        // Update the DB metrics continually as we drip
        await step.run(`update-metrics-${i}`, async () => {
          await db.update(broadcasts)
            .set({ totalRecipients: audience.length, totalDelivered })
            .where(eq(broadcasts.id, broadcastId));
        });

        // If this is NOT the last batch, sleep to dodge the Android OS SMS warning limit
        if (i < batches.length - 1) {
          logger.info(`Sleeping for ${SLEEP_DURATION} to bypass Android OS verification limit...`);
          await step.sleep(`sleep-between-batch-${i}`, SLEEP_DURATION);
        }
      }

      await step.run("mark-completed", async () => {
        await db.update(broadcasts)
          .set({ 
            status: totalDelivered > 0 ? "sent" : "failed",
            sentAt: new Date(),
            totalRecipients: audience.length,
            totalDelivered,
          })
          .where(eq(broadcasts.id, broadcastId));
      });

      return { status: totalDelivered > 0 ? "completed" : "failed", totalDelivered, totalFailed };
    }

    if (broadcast.channel === "email") {
      logger.info(`Sending email broadcast to ${audience.length} recipients...`);

      const batches = [];
      for (let i = 0; i < audience.length; i += EMAIL_BATCH_SIZE) {
        batches.push(audience.slice(i, i + EMAIL_BATCH_SIZE));
      }

      let totalDelivered = 0;
      let totalFailed = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const result = await step.run(`send-email-batch-${i}`, async () => {
          const settled = await Promise.allSettled(
            batch.map((contact) =>
              sendMail(contact.email as string, broadcast.title, broadcast.content || "")
            )
          );

          let delivered = 0;
          let failed = 0;
          for (const row of settled) {
            if (row.status === "fulfilled") delivered += 1;
            else failed += 1;
          }
          return { delivered, failed };
        });

        totalDelivered += result.delivered;
        totalFailed += result.failed;

        await step.run(`update-email-metrics-${i}`, async () => {
          await db.update(broadcasts)
            .set({
              totalRecipients: audience.length,
              totalDelivered,
            })
            .where(eq(broadcasts.id, broadcastId));
        });
      }

      await step.run("mark-email-completed", async () => {
        await db.update(broadcasts)
          .set({
            status: totalDelivered > 0 ? "sent" : "failed",
            sentAt: new Date(),
            totalRecipients: audience.length,
            totalDelivered,
          })
          .where(eq(broadcasts.id, broadcastId));
      });

      return { status: totalDelivered > 0 ? "completed" : "failed", totalDelivered, totalFailed };
    }

    await step.run("mark-unsupported", async () => {
      await db.update(broadcasts)
        .set({ status: "failed" })
        .where(eq(broadcasts.id, broadcastId));
    });
    logger.info("Broadcast channel is unsupported. Marked as failed.");
    return { status: "failed", reason: "unsupported_channel" };
  }
);
