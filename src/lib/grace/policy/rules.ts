import type { GraceChannel } from "../types";

export const highRiskTools = new Set([
  "contacts.archive",
  "contacts.delete",
  "contacts.merge",
  "appointments.cancel",
  "appointments.delete",
  "pipeline.deleteItem",
  "volunteers.delete",
  "volunteerShifts.delete",
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
  "contacts.upsert",
  "churchInfo.search",
  "prayerRequests.create",
  "appointments.checkAvailability",
  "appointments.book",
  "messages.sendSMS",
  "messages.sendEmail",
  "staff.alert",
  "handoff.transfer",
  "tasks.create",
  "onboarding.profile.update",
  "onboarding.installStarterTemplates",
  "onboarding.bootstrapSampleData",
  "onboarding.startGuidedSequence",
  "memory.write",
  "serviceRuns.createFromTemplate",
  "serviceRuns.autoStaff",
  "serviceAssignments.sendOfferSMS",
  "pipelines.addToStage",
  "contacts.search",
  "contacts.update",
  "contacts.archive",
  "contacts.restore",
  "contacts.delete",
  "contacts.findDuplicates",
  "contacts.merge",
  "tasks.search",
  "finance.weeklyReport",
  "tasks.update",
  "tasks.complete",
  "prayerRequests.update",
  "appointments.search",
  "appointments.setStatus",
  "appointments.reschedule",
  "appointments.delete",
  "appointments.cancel",
  "calls.search",
  "calls.update",
  "calls.escalate",
  "pipeline.search",
  "pipeline.updateItem",
  "pipeline.deleteItem",
  "pipeline.audit",
  "volunteers.create",
  "volunteers.update",
  "volunteers.delete",
  "volunteerShifts.create",
  "volunteerShifts.update",
  "volunteerShifts.delete",
  "pipeline.moveStage",
  "ministries.addMember",
  "conversations.search",
  "conversations.setStatus",
  "conversations.waiting",
  "conversations.archive",
  "conversations.reopen",
  "conversations.resolve",
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
