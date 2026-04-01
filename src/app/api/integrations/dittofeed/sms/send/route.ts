import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqualString } from "@/lib/security/compare";
import { resolveDittofeedProviderByWorkspaceId } from "@/lib/dittofeed/provider";
import {
  buildDittofeedSmsMetadata,
  trackDittofeedSmsQueued,
} from "@/lib/dittofeed/sms";
import {
  queueOutboundSmsMessages,
  SmsGatewayError,
} from "@/lib/sms-gateway/queue-outbound";

const sendSchema = z
  .object({
    recipient: z.string().trim().min(1).optional(),
    recipients: z.array(z.string().trim().min(1)).optional(),
    messageText: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
    workspaceId: z.string().trim().min(1).optional(),
    dittofeed: z
      .object({
        workspaceId: z.string().trim().min(1).optional(),
        messageId: z.string().trim().min(1).optional(),
        journeyId: z.string().trim().min(1).optional(),
        nodeId: z.string().trim().min(1).optional(),
        userId: z.string().trim().min(1).optional(),
        runId: z.string().trim().min(1).optional(),
        templateId: z.string().trim().min(1).optional(),
        channel: z.string().trim().min(1).optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const recipients = value.recipients?.length
      ? value.recipients
      : value.recipient
        ? [value.recipient]
        : [];

    if (recipients.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recipient or recipients is required",
        path: ["recipient"],
      });
    }

    if (!(value.messageText ?? value.message)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "messageText or message is required",
        path: ["messageText"],
      });
    }

    if (!(value.dittofeed?.workspaceId ?? value.workspaceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "workspaceId is required",
        path: ["workspaceId"],
      });
    }
  });

function getWebhookSecret(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return req.headers.get("x-dittofeed-secret");
}

export async function POST(req: NextRequest) {
  try {
    const body = sendSchema.parse(await req.json());
    const workspaceId = body.dittofeed?.workspaceId ?? body.workspaceId!;
    const provider = await resolveDittofeedProviderByWorkspaceId(workspaceId);

    if (!provider) {
      return NextResponse.json(
        { error: "No active Dittofeed workspace mapping found" },
        { status: 404 }
      );
    }

    const providedSecret = getWebhookSecret(req);
    if (!timingSafeEqualString(providedSecret, provider.smsWebhookSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recipients =
      body.recipients?.length && body.recipients.length > 0
        ? body.recipients
        : [body.recipient!];
    const message = body.messageText ?? body.message!;

    const metadata = buildDittofeedSmsMetadata({
      workspaceId,
      messageId: body.dittofeed?.messageId,
      journeyId: body.dittofeed?.journeyId,
      nodeId: body.dittofeed?.nodeId,
      userId: body.dittofeed?.userId,
      runId: body.dittofeed?.runId,
      templateId: body.dittofeed?.templateId,
      channel: body.dittofeed?.channel ?? "Webhook",
    });

    const { device, messages } = await queueOutboundSmsMessages({
      organizationId: provider.organizationId,
      recipients,
      message,
      metadataJson: metadata,
    });

    await Promise.allSettled(messages.map((queuedMessage) => trackDittofeedSmsQueued(queuedMessage)));

    return NextResponse.json({
      success: true,
      organizationId: provider.organizationId,
      workspaceId,
      queued: messages.length,
      deviceId: device.id,
      messageIds: messages.map((queuedMessage) => queuedMessage.id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SmsGatewayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[Dittofeed SMS] Failed to queue SMS:", error);
    return NextResponse.json(
      { error: "Failed to send Dittofeed SMS" },
      { status: 500 }
    );
  }
}
