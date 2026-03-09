import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { smsMessages, smsDevices } from "@/db/schema/sms-gateway";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/sms-gateway/send — Queue outbound SMS
 * Internal route: called by GRACE/Inngest functions, not exposed to churches.
 * Resolves the org's assigned device → sends via FCM push to that Android phone.
 */
export async function POST(req: NextRequest) {
  // Internal auth: require API key for internal service calls
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.SMS_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organizationId, recipients, message } = body;

  if (!organizationId || !recipients?.length || !message) {
    return NextResponse.json(
      { error: "organizationId, recipients, and message are required" },
      { status: 400 }
    );
  }

  // Find active device for this org
  const [device] = await db
    .select()
    .from(smsDevices)
    .where(
      and(
        eq(smsDevices.organizationId, organizationId),
        eq(smsDevices.isActive, true)
      )
    )
    .limit(1);

  if (!device) {
    return NextResponse.json(
      { error: "No active SMS device assigned to this organization" },
      { status: 422 }
    );
  }

  // Insert message records for each recipient
  const messages = [];
  for (const recipient of recipients as string[]) {
    const [msg] = await db
      .insert(smsMessages)
      .values({
        organizationId,
        deviceId: device.id,
        direction: "outbound",
        fromNumber: device.phoneNumber,
        toNumber: recipient,
        body: message,
        status: "queued",
      })
      .returning();
    messages.push(msg);
  }

  // Send FCM push to the Android device
  if (device.fcmToken) {
    try {
      await sendFcmPush(device.fcmToken, {
        type: "SEND_SMS",
        messages: messages.map((m) => ({
          id: m.id,
          to: m.toNumber,
          body: m.body,
        })),
      });
    } catch (err) {
      console.error("[SMS Gateway] FCM push failed:", err);
      // Messages stay queued — device will pick up next poll
    }
  }

  return NextResponse.json({
    queued: messages.length,
    deviceId: device.id,
    messageIds: messages.map((m) => m.id),
  });
}

/**
 * Send FCM push notification to an Android device.
 * Uses Firebase HTTP v1 API via service account.
 */
async function sendFcmPush(
  fcmToken: string,
  data: Record<string, unknown>
): Promise<void> {
  const fcmUrl = process.env.FCM_SERVER_URL;
  const fcmKey = process.env.FCM_SERVER_KEY;

  if (!fcmUrl || !fcmKey) {
    console.warn("[SMS Gateway] FCM not configured — skipping push");
    return;
  }

  const response = await fetch(fcmUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${fcmKey}`,
    },
    body: JSON.stringify({
      to: fcmToken,
      data,
      priority: "high",
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM push failed: ${response.status} ${response.statusText}`);
  }
}
