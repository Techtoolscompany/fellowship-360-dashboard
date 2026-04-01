import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  consumeSmsGatewayEnrollmentToken,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import { serializeSmsGatewayClientDevice } from "@/lib/sms-gateway/client-contract";

const enrollSchema = z.object({
  enrollmentToken: z.string().min(1),
  deviceName: z.string().trim().optional().nullable(),
  phoneNumber: z.string().trim().optional().nullable(),
  fcmToken: z.string().trim().optional().nullable(),
  manufacturer: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  buildId: z.string().trim().optional().nullable(),
  appVersionName: z.string().trim().optional().nullable(),
  appVersionCode: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = enrollSchema.parse(await req.json());
    const { device, authToken } = await consumeSmsGatewayEnrollmentToken({
      enrollmentToken: body.enrollmentToken,
      deviceName: body.deviceName,
      phoneNumber: body.phoneNumber,
      fcmToken: body.fcmToken,
      statusJson: {
        manufacturer: body.manufacturer ?? null,
        model: body.model ?? null,
        buildId: body.buildId ?? null,
        appVersionName: body.appVersionName ?? null,
        appVersionCode: body.appVersionCode ?? null,
      },
    });

    return NextResponse.json(
      await serializeSmsGatewayClientDevice(device, authToken)
    );
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
