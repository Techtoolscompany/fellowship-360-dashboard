import type { GraceChannel } from "../types";

export const highRiskTools = new Set([
  "messages.sendSMS",
  "messages.sendEmail",
  "appointments.book",
  "appointments.cancel",
  "contacts.upsert",
  "serviceRuns.createFromTemplate",
  "serviceRuns.autoStaff",
  "serviceAssignments.sendOfferSMS",
]);

// Public-safe tool set: no direct outbound sends, no arbitrary record edits
const publicSafeTools = new Set([
  "churchInfo.search",
  "prayerRequests.create",
  "appointments.checkAvailability",
  "handoff.transfer",
]);

// Internal staff tool set: full CRM + outbound capability
const staffTools = new Set([
  "churchInfo.search",
  "prayerRequests.create",
  "appointments.checkAvailability",
  "appointments.book",
  "appointments.cancel",
  "handoff.transfer",
  "contacts.upsert",
  "contacts.search",
  "contacts.update",
  "messages.sendSMS",
  "messages.sendEmail",
  "tasks.create",
  "tasks.update",
  "tasks.complete",
  "prayerRequests.update",
  "memory.write",
  "staff.alert",
  "pipelines.addToStage",
  "pipeline.moveStage",
  "ministries.addMember",
  "conversations.resolve",
  "serviceRuns.createFromTemplate",
  "serviceRuns.autoStaff",
  "serviceAssignments.sendOfferSMS",
]);

export const allowedByChannel: Record<GraceChannel, Set<string>> = {
  // Internal channels — full staff access
  voice_internal: staffTools,
  in_app: staffTools,

  // Legacy "voice" used by internal voice-chat route — treat as internal
  voice: staffTools,

  // Public channels — restricted to public-safe tools only
  // Org policy (allowedPublicTools) can expand this at runtime via evaluatePolicy
  voice_public: publicSafeTools,
  sms_public: publicSafeTools,
  web_public: publicSafeTools,

  // Legacy "sms" and "web" used by older webhooks — treat as public until migrated
  sms: publicSafeTools,
  web: publicSafeTools,
};
