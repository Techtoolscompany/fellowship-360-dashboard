import { sendOrganizationSms } from "@/lib/sms-gateway/send";

export async function sendTextBeeSMS(params: {
  organizationId?: string;
  to: string;
  message: string;
  idempotencyKey: string;
  config?: { apiKey: string; baseUrl: string };
}) {
  if (params.organizationId) {
    return sendOrganizationSms({
      organizationId: params.organizationId,
      to: params.to,
      message: params.message,
      idempotencyKey: params.idempotencyKey,
      metadataJson: { source: "legacy_grace_textbee_channel" },
    });
  }

  const apiKey = params.config?.apiKey ?? process.env.TEXTBEE_API_KEY;
  const baseUrl = params.config?.baseUrl ?? process.env.TEXTBEE_BASE_URL;

  if (!apiKey || !baseUrl) {
    return {
      success: false,
      providerMessageId: null,
      deviceId: null,
      messageIds: [],
      queuedCount: 0,
      error: "TEXTBEE not configured",
    };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify({ to: params.to, message: params.message }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        providerMessageId: null,
        deviceId: null,
        messageIds: [],
        queuedCount: 0,
        error: text || `TextBee send failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as { id?: string };
    return {
      success: true,
      providerMessageId: payload.id ?? null,
      deviceId: null,
      messageIds: payload.id ? [payload.id] : [],
      queuedCount: 1,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      providerMessageId: null,
      deviceId: null,
      messageIds: [],
      queuedCount: 0,
      error: error instanceof Error ? error.message : "Unknown TextBee error",
    };
  }
}
