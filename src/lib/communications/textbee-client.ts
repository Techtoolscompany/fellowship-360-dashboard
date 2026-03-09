import { appConfig } from "@/lib/config";

interface SendSmsParams {
  receivers: string[];
  smsBody: string;
  sender?: string;
}

/**
 * Sends an SMS using the TextBee API
 * TextBee uses a linked Android device as an SMS Gateway.
 */
export async function sendTextBeeSms({ receivers, smsBody, sender }: SendSmsParams) {
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
