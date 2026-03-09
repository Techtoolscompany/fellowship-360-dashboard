import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { smsMessages, smsDevices } from "@/db/schema/sms-gateway";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/sms-gateway/inbound — Receive inbound SMS from Android app
 * Auth: device API key
 * Creates message record and fires GRACE lead event for processing.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.SMS_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { deviceId, fromNumber, toNumber, body: smsBody } = body;

  if (!deviceId || !fromNumber || !smsBody) {
    return NextResponse.json(
      { error: "deviceId, fromNumber, and body are required" },
      { status: 400 }
    );
  }

  // Look up the device to find which org it belongs to
  const [device] = await db
    .select()
    .from(smsDevices)
    .where(eq(smsDevices.id, deviceId))
    .limit(1);

  if (!device || !device.organizationId) {
    return NextResponse.json(
      { error: "Device not found or not assigned to an organization" },
      { status: 422 }
    );
  }

  // Update device last seen
  await db
    .update(smsDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(smsDevices.id, deviceId));

  // Store inbound message
  const [message] = await db
    .insert(smsMessages)
    .values({
      organizationId: device.organizationId,
      deviceId: device.id,
      direction: "inbound",
      fromNumber,
      toNumber: toNumber || device.phoneNumber,
      body: smsBody,
      status: "delivered",
      deliveredAt: new Date(),
    })
    .returning();

  // Fire Inngest event for GRACE processing
  try {
    const { inngest } = await import("@/lib/inngest/client");
    const {
      INNGEST_EVENTS,
      buildLeadReceivedIdempotencyKey,
    } = await import("@/lib/inngest/events");

    await inngest.send({
      id: buildLeadReceivedIdempotencyKey({
        organizationId: device.organizationId,
        contactEmail: fromNumber, // use phone as identifier
        message: smsBody,
      }),
      name: INNGEST_EVENTS.GRACE_LEAD_RECEIVED,
      data: {
        organizationId: device.organizationId,
        contactName: fromNumber,
        contactEmail: fromNumber,
        message: smsBody,
        idempotencyKey: `sms-inbound-${message.id}`,
      },
    });
  } catch (err) {
    console.error("[SMS Gateway] Failed to fire GRACE event for inbound SMS:", err);
  }

  return NextResponse.json({ message, organizationId: device.organizationId });
}
