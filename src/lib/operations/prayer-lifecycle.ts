import type {
  PrayerEscalationPriority,
  PrayerStatus,
} from "@/lib/prayer/routing";
import { isPrayerRequestActive } from "@/lib/prayer/routing";

export function derivePrayerLifecycleEffects(params: {
  status: PrayerStatus;
  escalationPriority: PrayerEscalationPriority;
}) {
  const active = isPrayerRequestActive(params.status);

  return {
    ensureEscalationTask: active && params.escalationPriority !== "none",
    closeEscalationTasks: !active,
    enqueueFollowupSequence: active,
  };
}
