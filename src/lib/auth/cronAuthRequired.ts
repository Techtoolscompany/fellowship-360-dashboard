import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualString } from "@/lib/security/compare";
import {
  isPlaceholderCronPassword,
  isPlaceholderCronUsername,
  isProductionEnvironment,
} from "@/lib/security/production-readiness";

interface CronHandler {
  (
    req: NextRequest,
    context: {
      params: Promise<Record<string, unknown>>;
    }
  ): Promise<NextResponse | Response>;
}

const cronAuthRequired = (handler: CronHandler) => {
  return async (
    req: NextRequest,
    context: {
      params: Promise<Record<string, unknown>>;
    }
  ) => {
    // Get credentials from environment variables
    const CRON_USERNAME = process.env.CRON_USERNAME;
    const CRON_PASSWORD = process.env.CRON_PASSWORD;

    // Fail-secure: reject all cron requests if credentials are not configured
    if (!CRON_USERNAME || !CRON_PASSWORD) {
      console.error("[cron] CRON_USERNAME or CRON_PASSWORD not set — rejecting request");
      return NextResponse.json(
        { success: false, error: "Cron authentication not configured" },
        { status: 503 }
      );
    }

    if (
      isProductionEnvironment() &&
      (isPlaceholderCronUsername(CRON_USERNAME) || isPlaceholderCronPassword(CRON_PASSWORD))
    ) {
      console.error("[cron] Placeholder cron credentials detected in production — rejecting request");
      return NextResponse.json(
        { success: false, error: "Cron authentication is insecurely configured" },
        { status: 503 }
      );
    }

    // Authentication check
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required",
          error: "Missing or invalid Authorization header",
        },
        { status: 401, headers: { "WWW-Authenticate": "Basic" } }
      );
    }

    try {
      // Decode Basic Auth credentials
      const base64Credentials = authHeader.split(" ")[1];
      const decodedCredentials = Buffer.from(base64Credentials, "base64").toString("utf8");
      const delimiterIndex = decodedCredentials.indexOf(":");
      if (delimiterIndex <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid credentials format",
            error: "Username or password is incorrect",
          },
          { status: 401, headers: { "WWW-Authenticate": "Basic" } }
        );
      }

      const username = decodedCredentials.slice(0, delimiterIndex);
      const password = decodedCredentials.slice(delimiterIndex + 1);

      // Validate credentials
      if (
        !timingSafeEqualString(username, CRON_USERNAME) ||
        !timingSafeEqualString(password, CRON_PASSWORD)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid credentials",
            error: "Username or password is incorrect",
          },
          { status: 401, headers: { "WWW-Authenticate": "Basic" } }
        );
      }

      // Authentication successful, proceed to handler
      return await handler(req, context);
    } catch (error) {
      console.error("Error during cron authentication:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Authentication error",
          error: "Failed to process authentication",
        },
        { status: 401, headers: { "WWW-Authenticate": "Basic" } }
      );
    }
  };
};

export default cronAuthRequired;
