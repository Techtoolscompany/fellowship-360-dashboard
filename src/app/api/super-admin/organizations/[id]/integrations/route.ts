import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { organizations } from "@/db/schema/organization";
import { providerConfigs } from "@/db/schema/provider-configs";
import { smsDevices } from "@/db/schema/sms-gateway";
import {
  normalizeAndEncryptProviderConfig,
  redactProviderConfigForClient,
} from "@/lib/grace/providers/security";

const updateIntegrationSchema = z.object({
  smsDeviceId: z.string().nullable().optional(),
  provider: z
    .object({
      channel: z.string().min(1),
      provider: z.string().min(1),
      mode: z.enum(["agency_managed", "byo", "disabled"]),
      isActive: z.boolean().optional(),
      configJson: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

async function assertOrganizationExists(organizationId: string) {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new Error("Organization not found");
  }
}

async function loadIntegrationSnapshot(organizationId: string) {
  const [rows, devices] = await Promise.all([
    db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.organizationId, organizationId))
      .orderBy(desc(providerConfigs.updatedAt)),
    db
      .select({
        id: smsDevices.id,
        deviceName: smsDevices.deviceName,
        phoneNumber: smsDevices.phoneNumber,
        organizationId: smsDevices.organizationId,
        isActive: smsDevices.isActive,
        lastSeenAt: smsDevices.lastSeenAt,
        updatedAt: smsDevices.updatedAt,
      })
      .from(smsDevices)
      .orderBy(smsDevices.deviceName, smsDevices.createdAt),
  ]);

  const providers = rows.map((row) => {
    const redacted = redactProviderConfigForClient({
      channel: row.channel,
      provider: row.provider,
      config: row.configJson ?? {},
      mode: row.mode,
    });
    return {
      ...row,
      configJson: redacted.configJson,
      secretStatus: redacted.secretStatus,
      validation: redacted.validation,
    };
  });

  const assignedDevice = devices.find(
    (device) => device.organizationId === organizationId
  );

  return {
    providers,
    smsDevices: devices,
    assignedSmsDeviceId: assignedDevice?.id ?? null,
  };
}

export const GET = withSuperAdminAuthRequired(async (_req, context) => {
  const { id } = (await context.params) as { id: string };

  try {
    await assertOrganizationExists(id);
    const snapshot = await loadIntegrationSnapshot(id);
    return NextResponse.json({ success: true, ...snapshot });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load integrations";
    const status = message === "Organization not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});

export const PATCH = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = (await context.params) as { id: string };

  try {
    await assertOrganizationExists(id);

    const body = updateIntegrationSchema.parse(await req.json());

    if (body.smsDeviceId !== undefined) {
      if (body.smsDeviceId) {
        const [targetDevice] = await db
          .select({
            id: smsDevices.id,
            organizationId: smsDevices.organizationId,
          })
          .from(smsDevices)
          .where(eq(smsDevices.id, body.smsDeviceId))
          .limit(1);

        if (!targetDevice) {
          return NextResponse.json(
            { success: false, error: "SMS device not found" },
            { status: 404 }
          );
        }

        await db
          .update(smsDevices)
          .set({ organizationId: null, updatedAt: new Date() })
          .where(eq(smsDevices.organizationId, id));

        await db
          .update(smsDevices)
          .set({
            organizationId: id,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(smsDevices.id, body.smsDeviceId));

        await db
          .update(providerConfigs)
          .set({ isActive: true, updatedAt: new Date() })
          .where(
            and(
              eq(providerConfigs.organizationId, id),
              eq(providerConfigs.channel, "sms"),
              eq(providerConfigs.provider, "textbee")
            )
          );
      } else {
        await db
          .update(smsDevices)
          .set({ organizationId: null, updatedAt: new Date() })
          .where(eq(smsDevices.organizationId, id));
      }
    }

    if (body.provider) {
      const [existing] = await db
        .select()
        .from(providerConfigs)
        .where(
          and(
            eq(providerConfigs.organizationId, id),
            eq(providerConfigs.channel, body.provider.channel),
            eq(providerConfigs.provider, body.provider.provider)
          )
        )
        .limit(1);

      const normalized = normalizeAndEncryptProviderConfig({
        channel: body.provider.channel,
        provider: body.provider.provider,
        mode: body.provider.mode,
        incoming: body.provider.configJson,
        existing: existing?.configJson ?? {},
      });

      if (body.provider.mode === "byo" && !normalized.validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: `Missing required provider credentials: ${normalized.validation.missing.join(", ")}`,
          },
          { status: 400 }
        );
      }

      const nextIsActive =
        body.provider.mode === "disabled"
          ? false
          : (body.provider.isActive ?? existing?.isActive ?? true);

      if (existing) {
        const [updated] = await db
          .update(providerConfigs)
          .set({
            mode: body.provider.mode,
            isActive: nextIsActive,
            configJson: normalized.configJson,
            updatedAt: new Date(),
          })
          .where(eq(providerConfigs.id, existing.id))
          .returning();

        if (updated.isActive) {
          await db
            .update(providerConfigs)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
              and(
                eq(providerConfigs.organizationId, id),
                eq(providerConfigs.channel, body.provider.channel),
                eq(providerConfigs.isActive, true),
                ne(providerConfigs.id, updated.id)
              )
            );
        }
      } else {
        const [created] = await db
          .insert(providerConfigs)
          .values({
            organizationId: id,
            channel: body.provider.channel,
            provider: body.provider.provider,
            mode: body.provider.mode,
            isActive: nextIsActive,
            configJson: normalized.configJson,
          })
          .returning();

        if (created.isActive) {
          await db
            .update(providerConfigs)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
              and(
                eq(providerConfigs.organizationId, id),
                eq(providerConfigs.channel, body.provider.channel),
                eq(providerConfigs.isActive, true),
                ne(providerConfigs.id, created.id)
              )
            );
        }
      }
    }

    const snapshot = await loadIntegrationSnapshot(id);
    return NextResponse.json({ success: true, ...snapshot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to update integrations";
    const status = message === "Organization not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});
