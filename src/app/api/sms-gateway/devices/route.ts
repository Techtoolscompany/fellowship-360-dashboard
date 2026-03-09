import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { smsDevices } from "@/db/schema/sms-gateway";
import { providerConfigs } from "@/db/schema/provider-configs";
import { organizations } from "@/db/schema/organization";
import { and, eq } from "drizzle-orm";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";

/**
 * GET /api/sms-gateway/devices — List all devices (super admin only)
 * POST /api/sms-gateway/devices — Register new device from Android app (API key)
 * PATCH /api/sms-gateway/devices — Assign device to an org (super admin only)
 */

export const GET = withSuperAdminAuthRequired(async () => {
  const devices = await db
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

  return NextResponse.json({ devices });
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.SMS_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { deviceName, phoneNumber, fcmToken } = body;

  if (!deviceName || !fcmToken) {
    return NextResponse.json(
      { error: "deviceName and fcmToken are required" },
      { status: 400 }
    );
  }

  const [device] = await db
    .insert(smsDevices)
    .values({ deviceName, phoneNumber: phoneNumber || null, fcmToken })
    .returning();

  return NextResponse.json({ device }, { status: 201 });
}

export const PATCH = withSuperAdminAuthRequired(async (req: NextRequest) => {
  const body = await req.json();
  const { deviceId, organizationId } = body;

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  const [device] = await db
    .select()
    .from(smsDevices)
    .where(eq(smsDevices.id, deviceId))
    .limit(1);

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (organizationId) {
    // Keep assignment one-to-one by clearing previous device assignments for the org first.
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

  // When a device is assigned to an org, activate its SMS provider config.
  if (organizationId) {
    await db
      .update(providerConfigs)
      .set({ isActive: true, updatedAt: new Date() })
      .where(
        and(
          eq(providerConfigs.organizationId, organizationId),
          eq(providerConfigs.channel, "sms"),
          eq(providerConfigs.provider, "textbee")
        )
      );
  }

  return NextResponse.json({ device: updated });
});

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
});
