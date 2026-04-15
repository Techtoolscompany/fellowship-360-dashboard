import { db } from "@/db";
import {
  churchContacts,
  donations,
  graceFollowupProposals,
  organizations,
  tasks,
} from "@/db/schema";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { inngest } from "../client";
import { INNGEST_RETRY_PROFILES } from "../policy";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";

export const lapsedGiverRecovery = inngest.createFunction(
  { id: "lapsed-giver-recovery", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "30 9 * * 1" }, // every Monday at 9:30 AM
  async ({ step, logger }) => {
    const orgs = await step.run("fetch-organizations", async () => {
      return db.select({ id: organizations.id, name: organizations.name }).from(organizations);
    });

    const inactivityCutoff = new Date();
    inactivityCutoff.setDate(inactivityCutoff.getDate() - 90);

    const proposalDedupeCutoff = new Date();
    proposalDedupeCutoff.setDate(proposalDedupeCutoff.getDate() - 30);

    const results = await Promise.all(
      orgs.map((org) =>
        step.run(`process-org-${org.id}`, async () => {
          const donorSummaries = await db
            .select({
              contactId: donations.contactId,
              donationCount: count(),
              lastDonationAt: sql<Date>`max(${donations.date})`,
              totalGiven: sql<number>`coalesce(sum(${donations.amount}), 0)`,
            })
            .from(donations)
            .where(
              and(
                eq(donations.organizationId, org.id),
                sql`${donations.contactId} is not null`
              )
            )
            .groupBy(donations.contactId);

          const recentPending = await db
            .select({ contactId: graceFollowupProposals.contactId })
            .from(graceFollowupProposals)
            .where(
              and(
                eq(graceFollowupProposals.organizationId, org.id),
                eq(graceFollowupProposals.reason, "lapsed_giver_recovery"),
                eq(graceFollowupProposals.status, "pending"),
                gte(graceFollowupProposals.createdAt, proposalDedupeCutoff)
              )
            );

          const recentlyQueued = new Set(
            recentPending
              .map((row) => row.contactId)
              .filter((contactId): contactId is string => Boolean(contactId))
          );

          const lapsedDonors = donorSummaries.filter(
            (row) =>
              Boolean(row.contactId) &&
              Boolean(row.lastDonationAt) &&
              new Date(row.lastDonationAt).getTime() <= inactivityCutoff.getTime() &&
              !recentlyQueued.has(row.contactId as string)
          );

          const contactIds = lapsedDonors
            .map((row) => row.contactId)
            .filter((contactId): contactId is string => Boolean(contactId));

          if (contactIds.length === 0) {
            return { orgId: org.id, proposalsCreated: 0, tasksCreated: 0 };
          }

          const contacts = await db
            .select({
              id: churchContacts.id,
              firstName: churchContacts.firstName,
              lastName: churchContacts.lastName,
              email: churchContacts.email,
              phone: churchContacts.phone,
            })
            .from(churchContacts)
            .where(
              and(
                eq(churchContacts.organizationId, org.id),
                inArray(churchContacts.id, contactIds)
              )
            );

          const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
          const session = await getOrCreateGraceSession({
            organizationId: org.id,
            channel: "in_app",
            actorType: "system",
          });

          const proposalValues: Array<typeof graceFollowupProposals.$inferInsert> = [];
          const taskValues: Array<typeof tasks.$inferInsert> = [];

          for (const donor of lapsedDonors) {
            const contactId = donor.contactId as string;
            const contact = contactById.get(contactId);
            if (!contact) continue;

            const firstName = contact.firstName?.trim() || "friend";
            const fullName =
              `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "this donor";
            const recipient = contact.phone?.trim() || contact.email?.trim() || null;
            const lastDonationAt = donor.lastDonationAt
              ? new Date(donor.lastDonationAt)
              : null;

            if (recipient) {
              proposalValues.push({
                organizationId: org.id,
                sessionId: session.id,
                contactId,
                actorType: "system",
                channel: "in_app",
                proposedChannel: contact.phone?.trim() ? "sms" : "email",
                recipient,
                subject: "Lapsed giver recovery follow-up suggested",
                messageText: `Hi ${firstName}, this is Grace from ${org.name || "your church"}. We are grateful for your past generosity and wanted to check in. How can we pray for you this week?`,
                reason: "lapsed_giver_recovery",
                status: "pending",
                metadataJson: {
                  workflow: "donor_care",
                  lastDonationAt: lastDonationAt?.toISOString() ?? null,
                  donationCount: Number(donor.donationCount ?? 0),
                  totalGiven: Number(donor.totalGiven ?? 0),
                },
              });
            } else {
              taskValues.push({
                organizationId: org.id,
                title: `Lapsed giver follow-up: ${fullName}`,
                description: `This donor has not given in 90+ days and has no SMS/email recipient on file. Please assign direct outreach.\nLast gift: ${lastDonationAt?.toISOString() ?? "unknown"}`,
                priority: "high",
                status: "todo",
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              });
            }
          }

          if (proposalValues.length > 0) {
            await db.insert(graceFollowupProposals).values(proposalValues);
          }
          if (taskValues.length > 0) {
            await db.insert(tasks).values(taskValues);
          }

          return {
            orgId: org.id,
            proposalsCreated: proposalValues.length,
            tasksCreated: taskValues.length,
          };
        })
      )
    );

    logger.info("Lapsed giver recovery run complete", {
      organizations: orgs.length,
      results,
    });

    return {
      organizations: orgs.length,
      results,
    };
  }
);
