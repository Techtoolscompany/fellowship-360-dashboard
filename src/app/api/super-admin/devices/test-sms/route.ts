import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { smsDevices } from "@/db/schema/sms-gateway";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";

const sendTestSmsSchema = z.object({
  deviceId: z.string().min(1),
  to: z.string().trim().min(1),
  message: z.string().trim().min(1).max(320),
});

export const POST = withSuperAdminAuthRequired(async (req: NextRequest) => {
  try {
    const body = sendTestSmsSchema.parse(await req.json());

    const [device] = await db
      .select({
        id: smsDevices.id,
        deviceName: smsDevices.deviceName,
        organizationId: smsDevices.organizationId,
        isActive: smsDevices.isActive,
      })
      .from(smsDevices)
      .where(eq(smsDevices.id, body.deviceId))
      .limit(1);

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    if (!device.organizationId) {
      return NextResponse.json(
        { error: "Assign this device to a church before sending a test SMS" },
        { status: 422 }
      );
    }

    if (!device.isActive) {
      return NextResponse.json(
        { error: "Reactivate this device before sending a test SMS" },
        { status: 422 }
      );
    }

    const result = await sendOrganizationSms({
      organizationId: device.organizationId,
      to: body.to,
      message: body.message,
      metadataJson: {
        source: "super_admin_test_sms",
        deviceId: device.id,
        deviceName: device.deviceName,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to queue test SMS" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      queuedCount: result.queuedCount,
      deviceId: result.deviceId,
      messageIds: result.messageIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid test SMS payload" }, { status: 400 });
    }

    console.error("[Super Admin] Failed to queue test SMS:", error);
    return NextResponse.json({ error: "Failed to queue test SMS" }, { status: 500 });
  }
}, "manage_devices");
