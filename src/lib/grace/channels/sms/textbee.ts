export async function sendTextBeeSMS(params: {
  to: string;
  message: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const baseUrl = process.env.TEXTBEE_BASE_URL;

  if (!apiKey || !baseUrl) {
    return {
      success: false,
      providerMessageId: null,
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
        error: text || `TextBee send failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as { id?: string };
    return {
      success: true,
      providerMessageId: payload.id ?? null,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      providerMessageId: null,
      error: error instanceof Error ? error.message : "Unknown TextBee error",
    };
  }
}
