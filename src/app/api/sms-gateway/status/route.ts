import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  resolveSmsGatewayDeviceRequestAuth,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import {
  loadQueuedSmsMessagesForDevice,
  updateSmsGatewayDevicePresence,
} from "@/lib/sms-gateway/devices";

const statusSchema = z.object({
  deviceId: z.string().trim().optional().nullable(),
  phoneNumber: z.string().trim().optional().nullable(),
  fcmToken: z.string().trim().optional().nullable(),
  status: z.record(z.string(), z.unknown()).optional(),
  statusJson: z.record(z.string(), z.unknown()).optional(),
  pendingLimit: z.number().int().min(1).max(200).optional(),
});

function serializeDevice(device: NonNullable<Awaited<ReturnType<typeof updateSmsGatewayDevicePresence>>>) {
  return {
    id: device.id,
    organizationId: device.organizationId,
    deviceName: device.deviceName,
    phoneNumber: device.phoneNumber,
    isActive: device.isActive,
    lastSeenAt: device.lastSeenAt,
    enrolledAt: device.enrolledAt,
    authTokenLastUsedAt: device.authTokenLastUsedAt,
    statusJson: device.statusJson,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = statusSchema.parse(await req.json());
    const { device, authMethod } = await resolveSmsGatewayDeviceRequestAuth({
      req,
      deviceId: body.deviceId,
    });

    const updatedDevice = await updateSmsGatewayDevicePresence({
      deviceId: device.id,
      phoneNumber: body.phoneNumber,
      fcmToken: body.fcmToken,
      statusJson: body.statusJson ?? body.status,
    });

    if (!updatedDevice) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const pendingMessages = await loadQueuedSmsMessagesForDevice({
      deviceId: device.id,
      limit: body.pendingLimit,
    });

    return NextResponse.json({
      device: serializeDevice(updatedDevice),
      authMethod,
      pendingMessages,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid status payload" }, { status: 400 });
    }

    const status = error instanceof SmsGatewayAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync device status" },
      { status }
    );
  }
}
