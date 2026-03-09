import { inngest } from "../client";
import { db } from "@/db";
import { organizations, churchContacts, conversations, graceMemory } from "@/db/schema";
import { getGeminiClient } from "@/lib/ai/gemini-client";
import { and, eq, gt, gte } from "drizzle-orm";
import { INNGEST_RETRY_PROFILES } from "../policy";

export const dailyBriefing = inngest.createFunction(
  { id: "daily-briefing", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "0 7 * * *" }, // Run daily at 7 AM
  async ({ step, logger }) => {
    // 1. Fetch All Active Organizations
    const orgs = await step.run("fetch-organizations", async () => {
      return await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations);
    });

    // 2. Process each organization in parallel
    const batches = orgs.map((org) => {
      return step.run(`process-org-${org.id}`, async () => {
        // Find yesterday's date cutoff
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Fetch activity for yesterday
        const newContacts = await db
          .select()
          .from(churchContacts)
          .where(and(
            eq(churchContacts.organizationId, org.id),
            gt(churchContacts.createdAt, yesterday)
          ));

        const newConversations = await db
          .select({ id: conversations.id, subject: conversations.subject })
          .from(conversations)
          .where(and(
            eq(conversations.organizationId, org.id),
            gt(conversations.createdAt, yesterday)
          ));

        // Let AI Generate the Summary
        const gemini = getGeminiClient();
        const prompt = `You are a pastoral assistant for ${org.name || 'a church'}.
Based on the following activity from yesterday, generate a short, encouraging "Daily Briefing" for the pastoral team.
Focus on new leads, prayer requests, and key conversations. Be concise. Do not use markdown backticks around the whole response.

Data snapshot:
- New Contacts Added: ${newContacts.length}
- New Conversations/Requests: ${newConversations.map(c => c.subject).join(", ")}
`;

        const summary = await gemini.chat(prompt);

        const [existingToday] = await db
          .select({ id: graceMemory.id })
          .from(graceMemory)
          .where(
            and(
              eq(graceMemory.organizationId, org.id),
              eq(graceMemory.memoryType, "daily_briefing"),
              gte(graceMemory.createdAt, startOfToday)
            )
          )
          .limit(1);

        if (!existingToday) {
          await db.insert(graceMemory).values({
            organizationId: org.id,
            memoryType: "daily_briefing",
            summary: summary.slice(0, 320),
            details: summary,
            tags: ["daily_briefing", "executive_summary"],
            metadataJson: {
              generatedForDate: startOfToday.toISOString().slice(0, 10),
              contactsCount: newContacts.length,
              conversationsCount: newConversations.length,
            },
            createdByActorType: "system",
          });
        } else {
          logger.info("Daily briefing already exists for org/day, skipping insert", {
            organizationId: org.id,
            date: startOfToday.toISOString().slice(0, 10),
          });
        }

        return {
          orgId: org.id,
          contactsCount: newContacts.length,
          conversationsCount: newConversations.length,
        };
      });
    });

    const results = await Promise.all(batches);

    return {
      message: "Daily briefings generated",
      processedOrgs: results.length,
    };
  }
);
