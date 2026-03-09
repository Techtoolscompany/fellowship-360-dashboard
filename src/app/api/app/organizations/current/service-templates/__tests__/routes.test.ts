import { beforeEach, describe, expect, it, vi } from "vitest";

const operations = vi.hoisted(() => ({
  createServiceTemplate: vi.fn(),
  deleteServiceTemplate: vi.fn(),
  getServiceTemplate: vi.fn(),
  getServiceTemplates: vi.fn(),
  updateServiceTemplate: vi.fn(),
}));

vi.mock("@/lib/auth/withOrganizationAuthRequired", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("@/app/actions/operations", () => operations);

describe("service template API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /service-templates returns templates for the org", async () => {
    operations.getServiceTemplates.mockResolvedValueOnce([
      {
        template: { id: "tpl_1", name: "Sunday AM" },
        roleSlots: [],
        timelineSteps: [],
      },
    ]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost") as never, {
      session: { organization: { id: "org_1" } },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      serviceTemplates: [
        {
          template: { id: "tpl_1", name: "Sunday AM" },
          roleSlots: [],
          timelineSteps: [],
        },
      ],
    });
    expect(operations.getServiceTemplates).toHaveBeenCalledWith("org_1");
  });

  it("GET /service-templates returns setupRequired when migration is missing", async () => {
    operations.getServiceTemplates.mockRejectedValueOnce({ code: "42703" });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost") as never, {
      session: { organization: { id: "org_1" } },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      setupRequired: true,
      serviceTemplates: [],
    });
  });

  it("POST /service-templates creates a template", async () => {
    operations.createServiceTemplate.mockResolvedValueOnce({
      id: "tpl_2",
      name: "Midweek",
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          name: "Midweek",
          serviceType: "midweek",
        }),
      }) as never,
      { session: { organization: { id: "org_1" } } } as never
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      template: { id: "tpl_2", name: "Midweek" },
    });
    expect(operations.createServiceTemplate).toHaveBeenCalledWith({
      organizationId: "org_1",
      name: "Midweek",
      serviceType: "midweek",
    });
  });

  it("PATCH /service-templates/[templateId] returns 404 for missing template", async () => {
    operations.updateServiceTemplate.mockRejectedValueOnce(
      new Error("Service template not found")
    );

    const { PATCH } = await import("../[templateId]/route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name" }),
      }) as never,
      { params: Promise.resolve({ templateId: "tpl_missing" }) } as never
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      message: "Service template not found",
    });
  });

  it("DELETE /service-templates/[templateId] deletes the template", async () => {
    operations.deleteServiceTemplate.mockResolvedValueOnce(undefined);

    const { DELETE } = await import("../[templateId]/route");
    const response = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ templateId: "tpl_1" }),
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(operations.deleteServiceTemplate).toHaveBeenCalledWith("tpl_1");
  });
});
