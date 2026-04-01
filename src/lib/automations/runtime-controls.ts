const DEFAULT_MAX_CONCURRENT_RUNS = 25;
const DEFAULT_MAX_WORKFLOWS_PER_EVENT = 20;
const DEFAULT_CONCURRENCY_RETRY_MINUTES = 5;
const DEFAULT_DEAD_LETTER_BASE_RETRY_MINUTES = 15;
const DEFAULT_DEAD_LETTER_MAX_RETRY_MINUTES = 6 * 60;

export const AUTOMATION_RUNTIME_LIMITS = {
  maxConcurrentRunsPerWorkflow: DEFAULT_MAX_CONCURRENT_RUNS,
  maxWorkflowsPerEvent: DEFAULT_MAX_WORKFLOWS_PER_EVENT,
  concurrencyRetryMinutes: DEFAULT_CONCURRENCY_RETRY_MINUTES,
  deadLetterBaseRetryMinutes: DEFAULT_DEAD_LETTER_BASE_RETRY_MINUTES,
  deadLetterMaxRetryMinutes: DEFAULT_DEAD_LETTER_MAX_RETRY_MINUTES,
} as const;

export function evaluateAutomationConcurrency(params: {
  activeRuns: number;
  now?: Date;
  maxConcurrentRuns?: number;
  retryMinutes?: number;
}) {
  const maxConcurrentRuns =
    params.maxConcurrentRuns ?? AUTOMATION_RUNTIME_LIMITS.maxConcurrentRunsPerWorkflow;
  const retryMinutes =
    params.retryMinutes ?? AUTOMATION_RUNTIME_LIMITS.concurrencyRetryMinutes;
  const now = params.now ?? new Date();

  if (params.activeRuns >= maxConcurrentRuns) {
    return {
      allowed: false as const,
      reason: "concurrency_limit_reached" as const,
      retryAt: new Date(now.getTime() + retryMinutes * 60 * 1000),
      maxConcurrentRuns,
      activeRuns: params.activeRuns,
    };
  }

  return {
    allowed: true as const,
    maxConcurrentRuns,
    activeRuns: params.activeRuns,
  };
}

export function resolveWorkflowDispatchWindow(params: {
  workflowCount: number;
  maxWorkflowsPerEvent?: number;
}) {
  const maxWorkflowsPerEvent =
    params.maxWorkflowsPerEvent ?? AUTOMATION_RUNTIME_LIMITS.maxWorkflowsPerEvent;
  const selectedCount = Math.min(params.workflowCount, maxWorkflowsPerEvent);
  return {
    selectedCount,
    throttledCount: Math.max(0, params.workflowCount - selectedCount),
    maxWorkflowsPerEvent,
  };
}

export function computeDeadLetterRetryAt(params: {
  attemptCount: number;
  now?: Date;
  baseMinutes?: number;
  maxMinutes?: number;
}) {
  const now = params.now ?? new Date();
  const baseMinutes =
    params.baseMinutes ?? AUTOMATION_RUNTIME_LIMITS.deadLetterBaseRetryMinutes;
  const maxMinutes =
    params.maxMinutes ?? AUTOMATION_RUNTIME_LIMITS.deadLetterMaxRetryMinutes;

  const safeAttempt = Math.max(1, Math.floor(params.attemptCount));
  const backoffMinutes = Math.min(maxMinutes, baseMinutes * 2 ** (safeAttempt - 1));
  return new Date(now.getTime() + backoffMinutes * 60 * 1000);
}
