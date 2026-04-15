import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    insert,
    insertValues,
    insertReturning,
    handleInboundGraceSms: vi.fn(),
    resolveSmsGatewayDeviceRequestAuth: vi.fn(),
    updateSmsGatewayDevicePresence: vi.fn(),
    trackDittofeedSmsReply: vi.fn(),
  };
});

vi.mock("@/db", () => ({
  db: {
    insert: mocks.insert,
  },
}));

vi.mock("@/lib/grace/channels/sms/inbound", () => ({
  handleInboundGraceSms: mocks.handleInboundGraceSms,
}));

vi.mock("@/lib/sms-gateway/auth", () => ({
  SmsGatewayAuthError: class SmsGatewayAuthError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  resolveSmsGatewayDeviceRequestAuth: mocks.resolveSmsGatewayDeviceRequestAuth,
}));

vi.mock("@/lib/sms-gateway/devices", () => ({
  updateSmsGatewayDevicePresence: mocks.updateSmsGatewayDevicePresence,
}));

vi.mock("@/lib/dittofeed/sms", () => ({
  trackDittofeedSmsReply: mocks.trackDittofeedSmsReply,
}));

describe("SMS gateway inbound route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSmsGatewayDeviceRequestAuth.mockResolvedValue({
      device: {
        id: "device_1",
        organizationId: "org_1",
        phoneNumber: "+15557654321",
      },
    });
    mocks.insertReturning.mockResolvedValue([{ id: "sms_in_1" }]);
    mocks.handleInboundGraceSms.mockResolvedValue({
      ok: true,
      sessionId: "sess_1",
      response: "Thanks for texting.",
    });
  });

  it("logs the inbound SMS and hands it to GRACE", async () => {
    const { POST } = await import("../inbound/route");
    const response = await POST(
      new Request("http://localhost/api/sms-gateway/inbound", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          deviceId: "device_1",
          fromNumber: "+15551234567",
          body: "Hello Grace",
          metadataJson: {
            provider: "android-device",
          },
        }),
      }) as never
    );

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        deviceId: "device_1",
        direction: "inbound",
        fromNumber: "+15551234567",
        toNumber: "+15557654321",
        body: "Hello Grace",
        metadataJson: {
          source: "sms_gateway_device",
          provider: "android-device",
        },
      })
    );
    expect(mocks.handleInboundGraceSms).toHaveBeenCalledWith({
      organizationId: "org_1",
      fromNumber: "+15551234567",
      toNumber: "+15557654321",
      message: "Hello Grace",
      smsGatewayMessageId: "sms_in_1",
      source: "sms_gateway_device",
    });
    expect(mocks.trackDittofeedSmsReply).toHaveBeenCalledWith({
      organizationId: "org_1",
      fromNumber: "+15551234567",
      toNumber: "+15557654321",
      body: "Hello Grace",
      inboundMessageId: "sms_in_1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organizationId: "org_1",
      message: { id: "sms_in_1" },
      grace: {
        ok: true,
        sessionId: "sess_1",
        response: "Thanks for texting.",
      },
    });
  });
});
