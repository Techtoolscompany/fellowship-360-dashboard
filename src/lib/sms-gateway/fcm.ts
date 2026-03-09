/**
 * Firebase Cloud Messaging utility for pushing SMS payloads to the TextBee Android gateway app.
 * Uses Firebase HTTP v1 API.
 */

// Interface for the payload we send to the Android app
export interface TextBeePushPayload {
  type: "SEND_SMS";
  messages: Array<{
    id: string; // our internal message ID
    to: string; // destination phone number
    body: string; // SMS content
  }>;
}

/**
 * Send an FCM push notification using Google Application Default Credentials.
 * Required Env variables:
 * - FCM_SERVER_URL: e.g., https://fcm.googleapis.com/v1/projects/YOUR_PROJECT/messages:send
 * - FCM_SERVER_KEY: An OAuth2 access token for the Firebase service account.
 *   (In a production setup, you would typically use `google-auth-library` to mint
 *    short-lived tokens using a service account JSON file).
 */
export async function sendFcmPush(
  fcmToken: string,
  data: Record<string, unknown>
): Promise<void> {
  const fcmUrl = process.env.FCM_SERVER_URL;
  const fcmKey = process.env.FCM_SERVER_KEY; // Legacy Server Key OR valid OAuth2 token depending on URL used

  if (!fcmUrl || !fcmKey) {
    console.warn(
      "[SMS Gateway] FCM_SERVER_URL or FCM_SERVER_KEY not configured. Skipping push to " +
        fcmToken
    );
    return;
  }

  // Stringify all values in the 'data' payload because FCM HTTP v1 requires string values for data fields
  const stringifiedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    stringifiedData[key] = typeof value === "string" ? value : JSON.stringify(value);
  }

  const payload = {
    message: {
      token: fcmToken,
      data: stringifiedData,
      android: {
        priority: "high",
        direct_boot_ok: true,
      },
    },
  };

  const response = await fetch(fcmUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: fcmUrl.includes("v1") ? `Bearer ${fcmKey}` : `key=${fcmKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FCM push failed: ${response.status} ${errorText}`);
  }
}
