import { beforeEach, describe, expect, it, vi } from "vitest";

const graceActions = vi.hoisted(() => ({
  getGracePolicyConfig: vi.fn(),
  getGraceProviderConfigs: vi.fn(),
  updateGracePolicyConfig: vi.fn(),
  upsertGraceProviderConfig: vi.fn(),
}));

vi.mock("@/lib/auth/withOrganizationAuthRequired", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("@/app/actions/grace", () => graceActions);

describe("grace config API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /grace/config returns policy + provider configs", async () => {
    graceActions.getGracePolicyConfig.mockResolvedValueOnce({
      approvalsEnabled: true,
      autoEscalateOnEmergency: true,
    });
    graceActions.getGraceProviderConfigs.mockResolvedValueOnce([
      {
        channel: "sms",
        provider: "textbee",
        mode: "agency_managed",
        isActive: true,
      },
    ]);

    const { GET } = await import("../config/route");
    const response = await GET(new Request("http://localhost") as never, {
      session: { organization: { id: "org_1" } },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      policy: {
        approvalsEnabled: true,
        autoEscalateOnEmergency: true,
      },
      providers: [
        {
          channel: "sms",
          provider: "textbee",
          mode: "agency_managed",
          isActive: true,
        },
      ],
    });
    expect(graceActions.getGracePolicyConfig).toHaveBeenCalledWith("org_1");
    expect(graceActions.getGraceProviderConfigs).toHaveBeenCalledWith("org_1");
  });

  it("PATCH /grace/config updates policy and providers", async () => {
    graceActions.updateGracePolicyConfig.mockResolvedValueOnce({
      approvalsEnabled: false,
    });
    graceActions.upsertGraceProviderConfig.mockResolvedValueOnce({
      channel: "sms",
      provider: "textbee",
      mode: "byo",
      isActive: true,
    });

    const { PATCH } = await import("../config/route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          policy: {
            approvalsEnabled: false,
          },
          providers: [
            {
              channel: "sms",
              provider: "textbee",
              mode: "byo",
              isActive: true,
              configJson: { apiKey: "tb_test", baseUrl: "https://api.textbee.dev" },
            },
          ],
        }),
      }) as never,
      { session: { organization: { id: "org_1" } } } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      policy: { approvalsEnabled: false },
      providers: [
        {
          channel: "sms",
          provider: "textbee",
          mode: "byo",
          isActive: true,
        },
      ],
    });

    expect(graceActions.updateGracePolicyConfig).toHaveBeenCalledWith({
      organizationId: "org_1",
      approvalsEnabled: false,
    });
    expect(graceActions.upsertGraceProviderConfig).toHaveBeenCalledWith({
      organizationId: "org_1",
      channel: "sms",
      provider: "textbee",
      mode: "byo",
      isActive: true,
      configJson: { apiKey: "tb_test", baseUrl: "https://api.textbee.dev" },
    });
  });

  it("PATCH /grace/config returns 400 on action failure", async () => {
    graceActions.upsertGraceProviderConfig.mockRejectedValueOnce(
      new Error("Invalid provider credentials")
    );

    const { PATCH } = await import("../config/route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          providers: [
            {
              channel: "sms",
              provider: "textbee",
              mode: "byo",
              isActive: true,
            },
          ],
        }),
      }) as never,
      { session: { organization: { id: "org_1" } } } as never
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Invalid provider credentials",
    });
  });
});
