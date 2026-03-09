import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { smsMessages, smsDevices } from "@/db/schema/sms-gateway";
import { eq } from "drizzle-orm";

/**
 * POST /api/sms-gateway/webhook — Delivery status updates from Android app
 * Auth: device API key
 * Updates message status to sent/delivered/failed.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.SMS_GATEWAY_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { deviceId, messageId, status } = body;

  if (!messageId || !status) {
    return NextResponse.json(
      { error: "messageId and status are required" },
      { status: 400 }
    );
  }

  const validStatuses = ["sent", "delivered", "failed"] as const;
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  // Update message status
  const updateData: Record<string, unknown> = { status };
  if (status === "sent") updateData.sentAt = new Date();
  if (status === "delivered") {
    updateData.sentAt = updateData.sentAt || new Date();
    updateData.deliveredAt = new Date();
  }

  const [updated] = await db
    .update(smsMessages)
    .set(updateData as any)
    .where(eq(smsMessages.id, messageId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // Update device last seen
  if (deviceId) {
    await db
      .update(smsDevices)
      .set({ lastSeenAt: new Date() })
      .where(eq(smsDevices.id, deviceId));
  }

  return NextResponse.json({ message: updated });
}
