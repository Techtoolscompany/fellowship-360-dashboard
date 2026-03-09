import { appConfig } from "@/lib/config";

type SendMailResult = {
  id: string | null;
  mocked: boolean;
};

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Sends transactional email through Resend.
 * In development, this can operate in mock mode when RESEND_API_KEY is not set.
 */
const sendMail = async (
  to: string,
  subject: string,
  html: string
): Promise<SendMailResult> => {
  const trimmedTo = to.trim();
  if (!trimmedTo) {
    throw new Error("Email recipient is required");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ||
    `${appConfig.email.senderName} <${appConfig.email.senderEmail}>`;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL || undefined;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured");
    }

    console.warn(`[Email Mock] Missing RESEND_API_KEY. Would send "${subject}" to ${trimmedTo}`);
    return { id: null, mocked: true };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [trimmedTo],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { id?: string };
  return { id: payload.id ?? null, mocked: false };
};

export default sendMail;
