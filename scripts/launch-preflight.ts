import { and, eq, ne, sql } from "drizzle-orm";
import {
  hasDistributedRateLimitConfig,
  isPlaceholderCronPassword,
  isPlaceholderCronUsername,
  isWeakAuthSecret,
} from "../src/lib/security/production-readiness";

type CheckLevel = "PASS" | "WARN" | "FAIL";

type CheckResult = {
  level: CheckLevel;
  label: string;
  detail: string;
};

const results: CheckResult[] = [];

function record(level: CheckLevel, label: string, detail: string) {
  results.push({ level, label, detail });
}

function getFirstEnvValue(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return { key, value: value.trim() };
    }
  }
  return null;
}

function requireAnyEnv(label: string, keys: string[]) {
  const found = getFirstEnvValue(keys);
  if (!found) {
    record("FAIL", label, `Missing one of: ${keys.join(", ")}`);
    return null;
  }

  record("PASS", label, `Using ${found.key}`);
  return found.value;
}

function optionalAnyEnv(label: string, keys: string[]) {
  const found = getFirstEnvValue(keys);
  if (!found) {
    record("WARN", label, `Not set (${keys.join(", ")})`);
    return null;
  }

  record("PASS", label, `Using ${found.key}`);
  return found.value;
}

function printResults() {
  console.log("\nLaunch preflight results:");
  for (const result of results) {
    const icon =
      result.level === "PASS" ? "[PASS]" : result.level === "WARN" ? "[WARN]" : "[FAIL]";
    console.log(`${icon} ${result.label} - ${result.detail}`);
  }
}

async function run() {
  console.log("Running agency launch preflight...\n");

  const databaseUrl = requireAnyEnv("Database URL", ["DATABASE_URL"]);
  const superAdminEmails = requireAnyEnv("Super admin emails", ["SUPER_ADMIN_EMAILS"]);
  const authSecret = requireAnyEnv("Auth secret", ["AUTH_SECRET", "NEXTAUTH_SECRET"]);
  requireAnyEnv("App URL", ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]);
  const sessionSecret = requireAnyEnv("Session secret", ["SESSION_SECRET", "AUTH_SECRET"]);
  requireAnyEnv("Gemini API key", ["GEMINI_API_KEY"]);
  requireAnyEnv("Provider encryption key", [
    "GRACE_PROVIDER_ENCRYPTION_KEY",
    "AUTH_SECRET",
  ]);
  requireAnyEnv("Automation system token", [
    "AUTOMATION_SYSTEM_TOKEN",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
  ]);

  optionalAnyEnv("SMS gateway API key", ["SMS_GATEWAY_API_KEY"]);
  optionalAnyEnv("Google OAuth credentials", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
  optionalAnyEnv("Upstash Redis URL", ["UPSTASH_REDIS_REST_URL"]);
  optionalAnyEnv("Upstash Redis token", ["UPSTASH_REDIS_REST_TOKEN"]);
  optionalAnyEnv("Cron username", ["CRON_USERNAME"]);
  optionalAnyEnv("Cron password", ["CRON_PASSWORD"]);

  if (authSecret && isWeakAuthSecret(authSecret)) {
    record("FAIL", "Auth secret strength", "AUTH_SECRET is using a default or weak value");
  }

  if (sessionSecret && isWeakAuthSecret(sessionSecret)) {
    record("FAIL", "Session secret strength", "SESSION_SECRET is using a default or weak value");
  }

  if (!hasDistributedRateLimitConfig()) {
    record(
      "FAIL",
      "Distributed rate limiting",
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for production-safe rate limiting"
    );
  }

  if (isPlaceholderCronUsername(process.env.CRON_USERNAME)) {
    record("FAIL", "Cron username strength", "CRON_USERNAME is still using the default placeholder");
  }

  if (isPlaceholderCronPassword(process.env.CRON_PASSWORD)) {
    record("FAIL", "Cron password strength", "CRON_PASSWORD is still using the default placeholder");
  }

  if (superAdminEmails) {
    const parsedEmails = superAdminEmails
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    if (parsedEmails.length === 0) {
      record("FAIL", "Super admin email list", "Configured value is empty");
    } else {
      record(
        "PASS",
        "Super admin email list",
        `${parsedEmails.length} configured (${parsedEmails.join(", ")})`
      );
    }
  }

  if (databaseUrl) {
    try {
      const [{ db }, schema] = await Promise.all([
        import("../src/db"),
        import("../src/db/schema"),
      ]);

      const [orgCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.organizations);
      const orgCount = Number(orgCountRow?.count ?? 0);

      if (orgCount <= 0) {
        record("FAIL", "Organizations", "No organizations found in database");
      } else {
        record("PASS", "Organizations", `${orgCount} org(s) available`);
      }

      const [providerOrgCountRow] = await db
        .select({
          count: sql<number>`count(distinct ${schema.providerConfigs.organizationId})`,
        })
        .from(schema.providerConfigs)
        .where(
          and(
            eq(schema.providerConfigs.isActive, true),
            ne(schema.providerConfigs.mode, "disabled")
          )
        );
      const providerOrgCount = Number(providerOrgCountRow?.count ?? 0);

      if (providerOrgCount <= 0) {
        record("FAIL", "Provider coverage", "No org has active provider config");
      } else if (providerOrgCount < orgCount) {
        record(
          "WARN",
          "Provider coverage",
          `${providerOrgCount}/${orgCount} orgs have active provider config`
        );
      } else {
        record("PASS", "Provider coverage", "All orgs have active provider config");
      }

      const [smsOrgCountRow] = await db
        .select({
          count: sql<number>`count(distinct ${schema.smsDevices.organizationId})`,
        })
        .from(schema.smsDevices)
        .where(
          and(
            eq(schema.smsDevices.isActive, true),
            sql`${schema.smsDevices.organizationId} is not null`
          )
        );
      const smsOrgCount = Number(smsOrgCountRow?.count ?? 0);

      if (smsOrgCount <= 0) {
        record("WARN", "SMS device assignments", "No active SMS devices are assigned to orgs");
      } else {
        record("PASS", "SMS device assignments", `${smsOrgCount} org(s) have active SMS devices`);
      }

      const [publishedTemplateRow] = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(schema.automationWorkflows)
        .where(
          and(
            eq(schema.automationWorkflows.mode, "template"),
            eq(schema.automationWorkflows.status, "published")
          )
        );
      const publishedTemplateCount = Number(publishedTemplateRow?.count ?? 0);

      if (publishedTemplateCount <= 0) {
        record("WARN", "Published templates", "No published template workflows found");
      } else {
        record(
          "PASS",
          "Published templates",
          `${publishedTemplateCount} published template workflow(s)`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      if (message.includes('relation "automation_workflow" does not exist')) {
        record(
          "FAIL",
          "Database schema",
          "Missing automation workflow tables. Apply pending DB migrations before launch."
        );
      } else {
        record("FAIL", "Database connectivity", message);
      }
    }
  }

  printResults();

  const failCount = results.filter((result) => result.level === "FAIL").length;
  const warnCount = results.filter((result) => result.level === "WARN").length;
  const passCount = results.filter((result) => result.level === "PASS").length;

  console.log(
    `\nSummary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[launch-preflight] unexpected failure:", message);
  process.exit(1);
});
