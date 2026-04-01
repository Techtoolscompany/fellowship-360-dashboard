import { describe, expect, it } from "vitest";
import {
  AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT,
  AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES,
  AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT,
  AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES,
  AGENCY_HEALTH_MIN_EVENTS,
  classifyAgencyHealthStatus,
} from "../agency-launch-contracts";
import { computeReadinessScore } from "../agency-health";

describe("agency health thresholds", () => {
  it("classifies status boundaries exactly", () => {
    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: true,
        smsHeartbeatMinutes: 10,
        aiErrorRate24h: 0,
        totalAiEvents24h: 0,
      })
    ).toBe("critical");

    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: false,
        smsHeartbeatMinutes: AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES + 1,
        aiErrorRate24h: 5,
        totalAiEvents24h: AGENCY_HEALTH_MIN_EVENTS,
      })
    ).toBe("critical");

    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: false,
        smsHeartbeatMinutes: AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES,
        aiErrorRate24h: 5,
        totalAiEvents24h: AGENCY_HEALTH_MIN_EVENTS,
      })
    ).toBe("degraded");

    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: false,
        smsHeartbeatMinutes: AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES,
        aiErrorRate24h: 5,
        totalAiEvents24h: AGENCY_HEALTH_MIN_EVENTS,
      })
    ).toBe("degraded");

    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: false,
        smsHeartbeatMinutes: AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES - 1,
        aiErrorRate24h: AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT - 0.1,
        totalAiEvents24h: AGENCY_HEALTH_MIN_EVENTS,
      })
    ).toBe("healthy");

    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: false,
        smsHeartbeatMinutes: 12,
        aiErrorRate24h: AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT,
        totalAiEvents24h: AGENCY_HEALTH_MIN_EVENTS,
      })
    ).toBe("degraded");

    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: false,
        smsHeartbeatMinutes: 12,
        aiErrorRate24h: AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT,
        totalAiEvents24h: AGENCY_HEALTH_MIN_EVENTS,
      })
    ).toBe("critical");

    expect(
      classifyAgencyHealthStatus({
        hasProviderGap: false,
        smsHeartbeatMinutes: 12,
        aiErrorRate24h: AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT,
        totalAiEvents24h: AGENCY_HEALTH_MIN_EVENTS - 1,
      })
    ).toBe("healthy");
  });

  it("keeps readiness scores monotonic as health worsens", () => {
    const healthy = computeReadinessScore({
      providerHealthStatus: "configured",
      smsHeartbeatMinutes: 15,
      aiErrorRate24h: 0,
      totalAiEvents24h: 30,
      automationFailures24h: 0,
    });

    const degraded = computeReadinessScore({
      providerHealthStatus: "configured",
      smsHeartbeatMinutes: 45,
      aiErrorRate24h: 20,
      totalAiEvents24h: 30,
      automationFailures24h: 2,
    });

    const critical = computeReadinessScore({
      providerHealthStatus: "missing",
      smsHeartbeatMinutes: 75,
      aiErrorRate24h: 50,
      totalAiEvents24h: 30,
      automationFailures24h: 4,
    });

    expect(healthy).toBeGreaterThan(degraded);
    expect(degraded).toBeGreaterThan(critical);
    expect(healthy).toBeGreaterThanOrEqual(80);
    expect(critical).toBeLessThan(60);
  });
});
