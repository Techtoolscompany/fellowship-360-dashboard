// Inngest uses exponential backoff with jitter by default; these retry counts
// define how many attempts each workflow class gets before failing.
export const INNGEST_RETRY_PROFILES = {
  CORE_AUTOMATION: 5,
  STANDARD: 3,
  SCHEDULED: 2,
  LOW_RISK: 1,
} as const;
