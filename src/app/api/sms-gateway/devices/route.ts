import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { providerConfigs } from "@/db/schema/provider-configs";
import { smsDevices } from "@/db/schema/sms-gateway";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import {
  issueSmsGatewayEnrollmentToken,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import { getSmsGatewayProviderCandidates } from "@/lib/sms-gateway/provider";
import { timingSafeEqualString } from "@/lib/security/compare";

/**
 * GET /api/sms-gateway/devices — List all devices (super admin only)
 * POST /api/sms-gateway/devices — Legacy device registration (API key) or manual device provisioning (super admin)
 * PATCH /api/sms-gateway/devices — Assign device or issue enrollment token (super admin only)
 */

const registerDeviceSchema = z.object({
  deviceName: z.string().min(1),
  phoneNumber: z.string().trim().optional().nullable(),
  fcmToken: z.string().min(1),
});

const createManualDeviceSchema = z.object({
  deviceName: z.string().min(1),
  phoneNumber: z.string().trim().optional().nullable(),
  organizationId: z.string().trim().optional().nullable(),
  issueEnrollmentToken: z.boolean().optional().default(false),
  enrollmentExpiresInMinutes: z.number().int().min(1).max(24 * 60).optional(),
});

const assignDeviceSchema = z.object({
  action: z.literal("assign").optional(),
  deviceId: z.string().min(1),
  organizationId: z.string().trim().optional().nullable(),
});

const issueEnrollmentSchema = z.object({
  action: z.literal("issue_enrollment_token"),
  deviceId: z.string().min(1),
  expiresInMinutes: z.number().int().min(1).max(24 * 60).optional(),
});

const setActiveSchema = z.object({
  action: z.literal("set_active"),
  deviceId: z.string().min(1),
  isActive: z.boolean(),
});

function serializeSmsDevice(device: typeof smsDevices.$inferSelect) {
  return {
    id: device.id,
    organizationId: device.organizationId,
    deviceName: device.deviceName,
    phoneNumber: device.phoneNumber,
    fcmToken: device.fcmToken,
    isActive: device.isActive,
    lastSeenAt: device.lastSeenAt,
    enrolledAt: device.enrolledAt,
    authTokenIssuedAt: device.authTokenIssuedAt,
    authTokenLastUsedAt: device.authTokenLastUsedAt,
    authTokenRevokedAt: device.authTokenRevokedAt,
    statusJson: device.statusJson,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    hasActiveAuthToken: Boolean(device.authTokenHash && !device.authTokenRevokedAt),
  };
}

async function activateSmsProviderForOrganization(organizationId: string) {
  await db
    .update(providerConfigs)
    .set({ isActive: true, updatedAt: new Date() })
    .where(
      and(
        eq(providerConfigs.organizationId, organizationId),
        eq(providerConfigs.channel, "sms"),
        inArray(providerConfigs.provider, getSmsGatewayProviderCandidates())
      )
    );
}

export const GET = withSuperAdminAuthRequired(async () => {
  const rows = await db
    .select({
      device: smsDevices,
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(smsDevices)
    .leftJoin(organizations, eq(smsDevices.organizationId, organizations.id))
    .orderBy(smsDevices.createdAt);

  return NextResponse.json({
    devices: rows.map((row) => ({
      device: serializeSmsDevice(row.device),
      organization: row.organization?.id ? row.organization : null,
    })),
  });
}, "manage_devices");

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (timingSafeEqualString(apiKey, process.env.SMS_GATEWAY_API_KEY)) {
    const body = await req.json();
    const parsed = registerDeviceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid device registration payload" },
        { status: 400 }
      );
    }

    const { deviceName, phoneNumber, fcmToken } = parsed.data;
    const normalizedPhoneNumber = phoneNumber?.trim() || null;

    const [existingDevice] = await db
      .select({ id: smsDevices.id })
      .from(smsDevices)
      .where(
        normalizedPhoneNumber
          ? and(
              eq(smsDevices.deviceName, deviceName),
              eq(smsDevices.phoneNumber, normalizedPhoneNumber)
            )
          : and(eq(smsDevices.deviceName, deviceName), isNull(smsDevices.phoneNumber))
      )
      .limit(1);

    if (existingDevice) {
      const [device] = await db
        .update(smsDevices)
        .set({
          phoneNumber: normalizedPhoneNumber,
          fcmToken,
          isActive: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(smsDevices.id, existingDevice.id))
        .returning();

      return NextResponse.json({ device: serializeSmsDevice(device) }, { status: 200 });
    }

    const [device] = await db
      .insert(smsDevices)
      .values({
        deviceName,
        phoneNumber: normalizedPhoneNumber,
        fcmToken,
        isActive: true,
        lastSeenAt: new Date(),
      })
      .returning();

    return NextResponse.json({ device: serializeSmsDevice(device) }, { status: 201 });
  }

  return withSuperAdminAuthRequired(async (request) => {
    try {
      const body = createManualDeviceSchema.parse(await request.json());

      if (body.organizationId) {
        await db
          .update(smsDevices)
          .set({ organizationId: null, updatedAt: new Date() })
          .where(eq(smsDevices.organizationId, body.organizationId));
      }

      const [device] = await db
        .insert(smsDevices)
        .values({
          deviceName: body.deviceName,
          phoneNumber: body.phoneNumber?.trim() || null,
          organizationId: body.organizationId || null,
          isActive: false,
        })
        .returning();

      if (body.organizationId) {
        await activateSmsProviderForOrganization(body.organizationId);
      }

      const response: {
        device: ReturnType<typeof serializeSmsDevice>;
        enrollment?: { token: string; expiresAt: Date };
      } = {
        device: serializeSmsDevice(device),
      };

      if (body.issueEnrollmentToken) {
        const enrollment = await issueSmsGatewayEnrollmentToken({
          deviceId: device.id,
          organizationId: device.organizationId,
          expiresInMinutes: body.enrollmentExpiresInMinutes,
          metadataJson: { source: "super_admin_create_device" },
        });
        response.enrollment = {
          token: enrollment.token,
          expiresAt: enrollment.expiresAt,
        };
      }

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid device payload" }, { status: 400 });
      }

      console.error("Failed to create manual SMS device:", error);
      return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
    }
  }, "manage_devices")(req, {
    params: Promise.resolve({}),
  });
}

export const PATCH = withSuperAdminAuthRequired(async (req: NextRequest) => {
  const body = await req.json();
  const action =
    body?.action === "issue_enrollment_token"
      ? "issue_enrollment_token"
      : body?.action === "set_active"
        ? "set_active"
        : "assign";

  if (action === "issue_enrollment_token") {
    const parsed = issueEnrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid enrollment token request" }, { status: 400 });
    }

    const [device] = await db
      .select()
      .from(smsDevices)
      .where(eq(smsDevices.id, parsed.data.deviceId))
      .limit(1);

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    try {
      const enrollment = await issueSmsGatewayEnrollmentToken({
        deviceId: device.id,
        organizationId: device.organizationId,
        expiresInMinutes: parsed.data.expiresInMinutes,
        metadataJson: { source: "super_admin_issue_enrollment" },
      });

      return NextResponse.json({
        device: serializeSmsDevice(device),
        enrollment: {
          token: enrollment.token,
          expiresAt: enrollment.expiresAt,
        },
      });
    } catch (error) {
      const status = error instanceof SmsGatewayAuthError ? error.status : 500;
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to issue enrollment token" },
        { status }
      );
    }
  }

  if (action === "set_active") {
    const parsed = setActiveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid device activation payload" }, { status: 400 });
    }

    const [device] = await db
      .update(smsDevices)
      .set({
        isActive: parsed.data.isActive,
        updatedAt: new Date(),
      })
      .where(eq(smsDevices.id, parsed.data.deviceId))
      .returning();

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    if (parsed.data.isActive && device.organizationId) {
      await activateSmsProviderForOrganization(device.organizationId);
    }

    return NextResponse.json({ device: serializeSmsDevice(device) });
  }

  const parsed = assignDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device assignment payload" }, { status: 400 });
  }

  const { deviceId, organizationId } = parsed.data;
  const [device] = await db
    .select()
    .from(smsDevices)
    .where(eq(smsDevices.id, deviceId))
    .limit(1);

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (organizationId) {
    await db
      .update(smsDevices)
      .set({ organizationId: null, updatedAt: new Date() })
      .where(eq(smsDevices.organizationId, organizationId));
  }

  const [updated] = await db
    .update(smsDevices)
    .set({
      organizationId: organizationId || null,
      isActive: organizationId ? true : device.isActive,
      updatedAt: new Date(),
    })
    .where(eq(smsDevices.id, deviceId))
    .returning();

  if (organizationId) {
    await activateSmsProviderForOrganization(organizationId);
  }

  return NextResponse.json({ device: serializeSmsDevice(updated) });
}, "manage_devices");

export const DELETE = withSuperAdminAuthRequired(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("id");

  if (!deviceId) {
    return NextResponse.json({ error: "Device id is required" }, { status: 400 });
  }

  const [device] = await db
    .select({ id: smsDevices.id })
    .from(smsDevices)
    .where(eq(smsDevices.id, deviceId))
    .limit(1);

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  await db.delete(smsDevices).where(eq(smsDevices.id, deviceId));
  return NextResponse.json({ success: true });
}, "manage_devices");
