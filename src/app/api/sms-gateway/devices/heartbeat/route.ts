import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  resolveSmsGatewayDeviceRequestAuth,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import {
  mergeSmsGatewayStatusJson,
  serializeSmsGatewayClientDevice,
} from "@/lib/sms-gateway/client-contract";
import { updateSmsGatewayDevicePresence } from "@/lib/sms-gateway/devices";

const heartbeatSchema = z.object({
  deviceId: z.string().trim().optional().nullable(),
  deviceName: z.string().trim().optional().nullable(),
  phoneNumber: z.string().trim().optional().nullable(),
  fcmToken: z.string().trim().optional().nullable(),
  manufacturer: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  buildId: z.string().trim().optional().nullable(),
  appVersionName: z.string().trim().optional().nullable(),
  appVersionCode: z.number().int().optional(),
  gatewayEnabled: z.boolean().optional(),
  receiveSmsEnabled: z.boolean().optional(),
  preferredSim: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = heartbeatSchema.parse(await req.json());
    const { device } = await resolveSmsGatewayDeviceRequestAuth({
      req,
      deviceId: body.deviceId,
    });

    const updatedDevice = await updateSmsGatewayDevicePresence({
      deviceId: device.id,
      deviceName: body.deviceName,
      phoneNumber: body.phoneNumber,
      fcmToken: body.fcmToken,
      statusJson: mergeSmsGatewayStatusJson(device.statusJson, {
        manufacturer: body.manufacturer,
        model: body.model,
        buildId: body.buildId,
        appVersionName: body.appVersionName,
        appVersionCode: body.appVersionCode,
        gatewayEnabled: body.gatewayEnabled,
        receiveSmsEnabled: body.receiveSmsEnabled,
        preferredSim: body.preferredSim,
      }),
    });

    if (!updatedDevice) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json(await serializeSmsGatewayClientDevice(updatedDevice));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid heartbeat payload" }, { status: 400 });
    }

    const status = error instanceof SmsGatewayAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync device heartbeat" },
      { status }
    );
  }
}
