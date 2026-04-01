import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  consumeSmsGatewayEnrollmentToken,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import { loadQueuedSmsMessagesForDevice } from "@/lib/sms-gateway/devices";

const enrollSchema = z.object({
  enrollmentToken: z.string().min(1),
  deviceName: z.string().trim().optional().nullable(),
  phoneNumber: z.string().trim().optional().nullable(),
  fcmToken: z.string().trim().optional().nullable(),
  status: z.record(z.string(), z.unknown()).optional(),
  pendingLimit: z.number().int().min(1).max(200).optional(),
});

function serializeDevice(device: Awaited<ReturnType<typeof consumeSmsGatewayEnrollmentToken>>["device"]) {
  return {
    id: device.id,
    organizationId: device.organizationId,
    deviceName: device.deviceName,
    phoneNumber: device.phoneNumber,
    isActive: device.isActive,
    enrolledAt: device.enrolledAt,
    lastSeenAt: device.lastSeenAt,
    statusJson: device.statusJson,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = enrollSchema.parse(await req.json());
    const { device, authToken } = await consumeSmsGatewayEnrollmentToken({
      enrollmentToken: body.enrollmentToken,
      deviceName: body.deviceName,
      phoneNumber: body.phoneNumber,
      fcmToken: body.fcmToken,
      statusJson: body.status ?? null,
    });

    const pendingMessages = await loadQueuedSmsMessagesForDevice({
      deviceId: device.id,
      limit: body.pendingLimit,
    });

    return NextResponse.json({
      device: serializeDevice(device),
      authToken,
      pendingMessages,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid enrollment payload" }, { status: 400 });
    }

    const status = error instanceof SmsGatewayAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrollment failed" },
      { status }
    );
  }
}
