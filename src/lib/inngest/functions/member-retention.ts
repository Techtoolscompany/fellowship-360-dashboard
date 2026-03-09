import { inngest } from "../client";
import { db } from "@/db";
import { organizations, churchContacts, graceFollowupProposals, tasks } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { INNGEST_RETRY_PROFILES } from "../policy";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";

export const memberRetention = inngest.createFunction(
  { id: "member-retention-check", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "0 9 * * 1" }, // Run every Monday at 9:00 AM
  async ({ step, logger }) => {
    // 1. Fetch Organizations
    const orgs = await step.run("fetch-organizations", async () => {
      return await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations);
    });

    const results = await Promise.all(
      orgs.map((org) => {
        return step.run(`check-retention-${org.id}`, async () => {
          // Calculate 4 weeks ago
          const fourWeeksAgo = new Date();
          fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
          const dedupeSince = new Date();
          dedupeSince.setDate(dedupeSince.getDate() - 14);

          // Find active members who haven't been updated or seen in 4 weeks
          const atRiskMembers = await db
            .select()
            .from(churchContacts)
            .where(and(
              eq(churchContacts.organizationId, org.id),
              eq(churchContacts.memberStatus, "member"),
              lte(churchContacts.updatedAt, fourWeeksAgo)
            ));

          const session = await getOrCreateGraceSession({
            organizationId: org.id,
            channel: "in_app",
            actorType: "system",
          });

          const recentPending = await db
            .select({ contactId: graceFollowupProposals.contactId })
            .from(graceFollowupProposals)
            .where(
              and(
                eq(graceFollowupProposals.organizationId, org.id),
                eq(graceFollowupProposals.reason, "member_retention_at_risk"),
                eq(graceFollowupProposals.status, "pending"),
                gte(graceFollowupProposals.createdAt, dedupeSince)
              )
            );

          const existingPendingByContact = new Set(
            recentPending
              .map((row) => row.contactId)
              .filter((contactId): contactId is string => Boolean(contactId))
          );

          const candidateMembers = atRiskMembers.filter(
            (member) => !existingPendingByContact.has(member.id)
          );

          const membersWithRecipients = candidateMembers.filter(
            (member) => Boolean(member.phone?.trim() || member.email?.trim())
          );
          const membersWithoutRecipients = candidateMembers.filter(
            (member) => !Boolean(member.phone?.trim() || member.email?.trim())
          );

          const proposalValues = membersWithRecipients
            .map((member) => {
              const firstName = member.firstName?.trim() || "Member";
              const recipient = member.phone?.trim() || member.email?.trim() || null;
              const proposedChannel = member.phone?.trim() ? "sms" : "email";
              const messageText =
                proposedChannel === "sms"
                  ? `Hi ${firstName}, this is Grace from ${org.name || "your church"}. We have missed seeing you and wanted to check in. How can we pray for you this week?`
                  : `Hi ${firstName}, this is Grace from ${org.name || "your church"}. We wanted to check in and let you know we care about you. Reply to let us know how we can support you this week.`;

              return {
                organizationId: org.id,
                sessionId: session.id,
                contactId: member.id,
                actorType: "system" as const,
                channel: "in_app",
                proposedChannel,
                recipient,
                subject: "Member care follow-up suggested",
                messageText,
                reason: "member_retention_at_risk",
                status: "pending" as const,
                metadataJson: {
                  workflow: "member_retention",
                  lastUpdatedAt: member.updatedAt?.toISOString?.() ?? null,
                  dedupeWindowDays: 14,
                },
              };
            });

          if (proposalValues.length > 0) {
            await db.insert(graceFollowupProposals).values(proposalValues);
          }

          let manualTasksCreated = 0;
          if (membersWithoutRecipients.length > 0) {
            await db.insert(tasks).values(
              membersWithoutRecipients.map((member) => {
                const firstName = member.firstName?.trim() || "Unknown";
                const lastName = member.lastName?.trim() || "Member";
                return {
                  organizationId: org.id,
                  title: `Manual care follow-up required: ${firstName} ${lastName}`,
                  description: `Grace identified this member as at-risk but no SMS/email recipient is available. Please assign a staff member for direct outreach.\nMember ID: ${member.id}\nLast updated: ${member.updatedAt?.toISOString?.() ?? "unknown"}`,
                  priority: "high" as const,
                  status: "todo" as const,
                  dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                };
              })
            );
            manualTasksCreated = membersWithoutRecipients.length;
          }

          logger.info(`[Member Retention] Org ${org.name} has ${atRiskMembers.length} at-risk members.`, {
            orgId: org.id,
            atRiskCount: atRiskMembers.length,
            proposalsCreated: proposalValues.length,
            manualTasksCreated,
            proposalsSkippedExisting: atRiskMembers.length - candidateMembers.length,
          });

          return {
            orgId: org.id,
            atRiskCount: atRiskMembers.length,
            proposalsCreated: proposalValues.length,
            manualTasksCreated,
          };
        });
      })
    );

    return {
      message: "Weekly member retention check complete",
      orgsProcessed: results.length,
    };
  }
);
