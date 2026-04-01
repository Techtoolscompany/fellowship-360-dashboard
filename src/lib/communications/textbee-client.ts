import { sendOrganizationSms } from "@/lib/sms-gateway/send";

interface SendSmsParams {
  organizationId?: string;
  receivers: string[];
  smsBody: string;
  sender?: string;
  idempotencyKey?: string;
}

/**
 * Sends an SMS using the TextBee API
 * TextBee uses a linked Android device as an SMS Gateway.
 */
export async function sendTextBeeSms({
  organizationId,
  receivers,
  smsBody,
  sender,
  idempotencyKey,
}: SendSmsParams) {
  if (sender) {
    void sender;
  }

  if (organizationId) {
    const result = await sendOrganizationSms({
      organizationId,
      to: receivers,
      message: smsBody,
      idempotencyKey,
      metadataJson: { source: "legacy_textbee_client" },
    });

    if (!result.success) {
      throw new Error(result.error ?? "SMS gateway send failed");
    }

    return { success: true, data: result };
  }

  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    console.warn("[TextBee] Missing API Key or Device ID. Mocking SMS send.");
    console.log(`[TextBee Mock] Would send: "${smsBody}" to ${receivers.join(', ')}`);
    return { success: true, mocked: true };
  }

  try {
    const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        receivers,
        smsBody,
        sender: sender || "Fellowship360",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TextBee API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("[TextBee] Failed to send SMS:", error);
    throw error;
  }
}
