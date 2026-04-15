import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { db } from "@/db";
import { aiConfig } from "@/db/schema/ai-config";
import { providerConfigs } from "@/db/schema/provider-configs";
import { organizations } from "@/db/schema/organization";
import { eq } from "drizzle-orm";
import { PRIMARY_SMS_GATEWAY_PROVIDER } from "@/lib/sms-gateway/provider";

/**
 * Auto-provisions provider configs when a new church org is created.
 * All keys come from agency env vars — churches never see them.
 *
 * SMS stays inactive until super admin assigns a Fellowship 360 Gateway device.
 * Voice/AI activate immediately with shared agency keys.
 */
export const provisionOrgProviders = inngest.createFunction(
  {
    id: "provision-org-providers",
    retries: 3,
  },
  { event: INNGEST_EVENTS.ORG_CREATED },
  async ({ event, step }) => {
    const { organizationId, churchName, churchDenomination, churchCity } =
      event.data;

    // Step 1: Create AI config for this org
    await step.run("create-ai-config", async () => {
      const existing = await db.query.aiConfig.findFirst({
        where: eq(aiConfig.organizationId, organizationId),
      });

      if (existing) return { skipped: true };

      await db.insert(aiConfig).values({
        organizationId,
        churchName: churchName || "New Church",
        churchDenomination: churchDenomination || null,
        churchCity: churchCity || null,
        graceEnabled: true,
        internalGraceEnabled: true,
        publicGraceEnabled: false,
        publicWidgetEnabled: false,
        publicPhoneEnabled: false,
      });

      return { created: true };
    });

    // Step 2: Create provider configs — all agency_managed
    await step.run("create-provider-configs", async () => {
      const providers = [
        {
          channel: "sms",
          provider: PRIMARY_SMS_GATEWAY_PROVIDER,
          mode: "agency_managed" as const,
          isActive: false, // inactive until device assigned
          configJson: { deviceId: null },
        },
        {
          channel: "voice",
          provider: "retell",
          mode: "agency_managed" as const,
          isActive: true,
          configJson: {
            agentId: process.env.RETELL_AGENT_ID || null,
            webhookSecret: process.env.RETELL_WEBHOOK_SECRET || null,
          },
        },
        {
          channel: "ai",
          provider: "gemini",
          mode: "agency_managed" as const,
          isActive: true,
          configJson: {
            apiKey: process.env.GEMINI_API_KEY || null,
          },
        },
        {
          channel: "email",
          provider: "sendgrid",
          mode: "disabled" as const,
          isActive: false,
          configJson: {},
        },
      ];

      for (const p of providers) {
        // Upsert: skip if already exists for this org+channel+provider
        const existing = await db
          .select({ id: providerConfigs.id })
          .from(providerConfigs)
          .where(eq(providerConfigs.organizationId, organizationId))
          .limit(1);

        // Simple insert with conflict ignore via try/catch
        try {
          await db.insert(providerConfigs).values({
            organizationId,
            channel: p.channel,
            provider: p.provider,
            mode: p.mode,
            isActive: p.isActive,
            configJson: p.configJson,
          });
        } catch (err: any) {
          // Unique constraint violation = already provisioned, skip
          if (err?.code === "23505") continue;
          throw err;
        }
      }

      return { provisioned: providers.length };
    });

    return { success: true, organizationId };
  }
);
