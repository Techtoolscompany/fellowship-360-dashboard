import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleInboundGraceSms: vi.fn(),
  rateLimitKeyed: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  resolveProviderWebhookSecret: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/grace/flags", () => ({
  graceFlags: {
    enabled: true,
    publicChannelsEnabled: true,
  },
}));

vi.mock("@/lib/grace/channels/sms/inbound", () => ({
  handleInboundGraceSms: mocks.handleInboundGraceSms,
}));

vi.mock("@/lib/grace/channels/webhooks", () => ({
  rateLimitKeyed: mocks.rateLimitKeyed,
  verifyWebhookSignature: mocks.verifyWebhookSignature,
}));

vi.mock("@/lib/grace/providers/resolver", () => ({
  resolveProviderWebhookSecret: mocks.resolveProviderWebhookSecret,
}));

vi.mock("@/lib/security/request", () => ({
  getClientIp: mocks.getClientIp,
}));

describe("GRACE SMS webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientIp.mockReturnValue("127.0.0.1");
    mocks.resolveProviderWebhookSecret.mockResolvedValue("secret");
    mocks.verifyWebhookSignature.mockReturnValue(true);
    mocks.rateLimitKeyed.mockResolvedValue(true);
  });

  it("passes inbound SMS to the shared GRACE handler", async () => {
    mocks.handleInboundGraceSms.mockResolvedValueOnce({
      ok: true,
      sessionId: "sess_1",
      response: "Thanks for reaching out.",
      conversationId: "conv_1",
      replyDelivery: {
        success: true,
        providerMessageId: "out_1",
        deviceId: "dev_1",
        messageIds: ["sms_1"],
        queuedCount: 1,
        error: null,
      },
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/sms/grace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-grace-signature": "sig",
        },
        body: JSON.stringify({
          organizationId: "org_1",
          sessionId: "sess_1",
          messageId: "msg_1",
          from: "+15551234567",
          message: "Need prayer",
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(mocks.handleInboundGraceSms).toHaveBeenCalledWith({
      organizationId: "org_1",
      message: "Need prayer",
      sessionId: "sess_1",
      providerMessageId: "msg_1",
      fromNumber: "+15551234567",
      source: "fellowship_gateway_webhook",
    });
    expect(await response.json()).toEqual({
      ok: true,
      sessionId: "sess_1",
      response: "Thanks for reaching out.",
      conversationId: "conv_1",
      replyDelivery: {
        success: true,
        providerMessageId: "out_1",
        deviceId: "dev_1",
        messageIds: ["sms_1"],
        queuedCount: 1,
        error: null,
      },
    });
  });
});
