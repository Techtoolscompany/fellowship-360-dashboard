import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectResponses: unknown[] = [];
  const requireOrganizationSectionAccess = vi.fn();
  const sendMail = vi.fn();
  const auditAction = vi.fn();

  const select = vi.fn(() => {
    const query: any = {
      from: vi.fn(() => query),
      where: vi.fn(() => query),
      leftJoin: vi.fn(() => query),
      groupBy: vi.fn(() => query),
      orderBy: vi.fn(() => query),
      limit: vi.fn(() => query),
      offset: vi.fn(() => query),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(selectResponses.shift() ?? []).then(onFulfilled, onRejected),
    };
    return query;
  });

  return {
    select,
    selectResponses,
    requireOrganizationSectionAccess,
    sendMail,
    auditAction,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/lib/access/section-guard", () => ({
  requireOrganizationSectionAccess: mocks.requireOrganizationSectionAccess,
}));

vi.mock("@/lib/email/sendMail", () => ({
  default: mocks.sendMail,
}));

vi.mock("../utils", () => ({
  auditAction: mocks.auditAction,
}));

import { sendDonorThankYou, sendPledgeReminder } from "../finances";

describe("finance notification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResponses.length = 0;
    mocks.requireOrganizationSectionAccess.mockResolvedValue({
      userId: "user_1",
      role: "admin",
      allowedSections: ["finance"],
    });
  });

  it("validates donor thank-you requires a contact email", async () => {
    mocks.selectResponses.push([{ name: "Fellowship 360" }]);
    mocks.selectResponses.push([
      { firstName: "Jordan", lastName: "Taylor", email: null },
    ]);
    mocks.selectResponses.push([{ totalGiven: 250, donationCount: 2 }]);

    await expect(
      sendDonorThankYou({
        organizationId: "org_1",
        contactId: "contact_1",
      })
    ).rejects.toThrow("Contact email is required");

    expect(mocks.requireOrganizationSectionAccess).toHaveBeenCalledWith({
      organizationId: "org_1",
      section: "finance",
      requiredRole: "admin",
    });
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.auditAction).not.toHaveBeenCalled();
  });

  it("sends donor thank-you and writes an audit record", async () => {
    mocks.selectResponses.push([{ name: "Fellowship 360" }]);
    mocks.selectResponses.push([
      {
        firstName: "Jordan",
        lastName: "Taylor",
        email: "jordan@example.com",
      },
    ]);
    mocks.selectResponses.push([{ totalGiven: 500, donationCount: 4 }]);

    const result = await sendDonorThankYou({
      organizationId: "org_1",
      contactId: "contact_1",
    });

    expect(result).toMatchObject({
      sent: true,
      contactEmail: "jordan@example.com",
      donationCount: 4,
      totalGiven: 500,
    });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.auditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        userId: "user_1",
        entityName: "donor_thank_you",
        entityId: "contact_1",
      })
    );
  });

  it("validates pledge reminders require a linked contact email", async () => {
    mocks.selectResponses.push([
      {
        id: "pledge_1",
        organizationId: "org_1",
        contactId: "contact_1",
        totalAmount: 1000,
        amountPaid: 200,
      },
    ]);
    mocks.selectResponses.push([{ name: "Fellowship 360" }]);
    mocks.selectResponses.push([
      { firstName: "Jordan", lastName: "Taylor", email: null },
    ]);

    await expect(sendPledgeReminder({ pledgeId: "pledge_1" })).rejects.toThrow(
      "Linked contact email is required"
    );

    expect(mocks.requireOrganizationSectionAccess).toHaveBeenCalledWith({
      organizationId: "org_1",
      section: "finance",
      requiredRole: "admin",
    });
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("sends pledge reminder and writes an audit record", async () => {
    mocks.selectResponses.push([
      {
        id: "pledge_1",
        organizationId: "org_1",
        contactId: "contact_1",
        totalAmount: 1000,
        amountPaid: 250,
      },
    ]);
    mocks.selectResponses.push([{ name: "Fellowship 360" }]);
    mocks.selectResponses.push([
      {
        firstName: "Jordan",
        lastName: "Taylor",
        email: "jordan@example.com",
      },
    ]);

    const result = await sendPledgeReminder({ pledgeId: "pledge_1" });

    expect(result).toMatchObject({
      sent: true,
      pledgeId: "pledge_1",
      contactEmail: "jordan@example.com",
      outstanding: 750,
    });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.auditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        userId: "user_1",
        entityName: "pledge_reminder",
        entityId: "pledge_1",
      })
    );
  });
});
