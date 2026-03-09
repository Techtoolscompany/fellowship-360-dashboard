export const SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE =
  "Service planning tables are not initialized yet. Apply the latest database migrations, then refresh.";

const SETUP_REQUIRED_CODES = new Set(["42P01", "42703"]);

export function isServicePlanningSetupRequiredError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code && SETUP_REQUIRED_CODES.has(code)) {
      return true;
    }
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    /relation\s+".+"\s+does not exist/i.test(error.message) ||
    /column\s+".+"\s+does not exist/i.test(error.message) ||
    /column\s+.+\s+does not exist/i.test(error.message)
  );
}
