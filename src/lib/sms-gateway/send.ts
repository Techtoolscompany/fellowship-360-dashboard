import {
  queueOutboundSmsMessages,
  SmsGatewayError,
} from "@/lib/sms-gateway/queue-outbound";

export type SendOrganizationSmsParams = {
  organizationId: string;
  to: string | string[];
  message: string;
  idempotencyKey?: string;
  metadataJson?: Record<string, unknown>;
};

export type SendOrganizationSmsResult = {
  success: boolean;
  providerMessageId: string | null;
  deviceId: string | null;
  messageIds: string[];
  queuedCount: number;
  error: string | null;
};

export async function sendOrganizationSms(
  params: SendOrganizationSmsParams
): Promise<SendOrganizationSmsResult> {
  try {
    const recipients = Array.isArray(params.to) ? params.to : [params.to];
    const { device, messages } = await queueOutboundSmsMessages({
      organizationId: params.organizationId,
      recipients,
      message: params.message,
      idempotencyKey: params.idempotencyKey,
      metadataJson: params.metadataJson,
    });

    return {
      success: true,
      providerMessageId: messages[0]?.id ?? null,
      deviceId: device.id,
      messageIds: messages.map((message) => message.id),
      queuedCount: messages.length,
      error: null,
    };
  } catch (error) {
    if (error instanceof SmsGatewayError) {
      return {
        success: false,
        providerMessageId: null,
        deviceId: null,
        messageIds: [],
        queuedCount: 0,
        error: error.message,
      };
    }

    return {
      success: false,
      providerMessageId: null,
      deviceId: null,
      messageIds: [],
      queuedCount: 0,
      error: error instanceof Error ? error.message : "Unknown SMS gateway error",
    };
  }
}
