import { beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL);

vi.mock("../utils", () => ({
  requireOrgMembership: vi.fn(async () => ({ userId: "db-integration-user" })),
  auditAction: vi.fn(async () => undefined),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn(async () => undefined),
  },
}));

describe.runIf(HAS_DATABASE_URL)("actions DB integration", () => {
  let db: (typeof import("@/db"))["db"];
  let organizations: (typeof import("@/db/schema"))["organizations"];
  let eq: (typeof import("drizzle-orm"))["eq"];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ organizations } = await import("@/db/schema"));
    ({ eq } = await import("drizzle-orm"));
  });

  it(
    "runs contacts/conversations/tasks/prayer CRUD flow against the database",
    async () => {
    const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const orgId = `org_it_${suffix}`;
    const slug = `it-org-${suffix}`;

    const {
      createContact,
      updateContact,
      getContact,
      deleteContact,
    } = await import("../contacts");
    const { createConversation, updateConversationStatus } = await import(
      "../communications"
    );
    const { createTask, transitionTaskStatus } = await import("../tasks");
    const { createPrayerRequest, updatePrayerRequest } = await import("../prayer");

    await db.insert(organizations).values({
      id: orgId,
      name: `Integration Org ${suffix}`,
      slug,
    });

    try {
      const contact = await createContact({
        firstName: "Integration",
        lastName: "Tester",
        email: `it-${suffix}@example.com`,
        phone: "5551112222",
        organizationId: orgId,
      });
      expect(contact.organizationId).toBe(orgId);

      const fetched = await getContact(contact.id);
      expect(fetched?.id).toBe(contact.id);

      const updatedContact = await updateContact(contact.id, {
        notes: "updated-from-integration-test",
      });
      expect(updatedContact.notes).toBe("updated-from-integration-test");

      const conversation = await createConversation({
        organizationId: orgId,
        contactId: contact.id,
        channel: "sms",
        subject: "Integration smoke",
      });
      expect(conversation.status).toBe("open");

      const waitingConversation = await updateConversationStatus(
        conversation.id,
        "waiting"
      );
      expect(waitingConversation.status).toBe("waiting");

      const task = await createTask({
        organizationId: orgId,
        title: "Integration follow-up task",
      });
      expect(task.status).toBe("todo");

      const progressedTask = await transitionTaskStatus({
        taskId: task.id,
        organizationId: orgId,
        status: "in_progress",
      });
      expect(progressedTask.status).toBe("in_progress");

      const prayer = await createPrayerRequest({
        organizationId: orgId,
        contactId: contact.id,
        contactName: "Integration Tester",
        content: "Please pray for steady launch rollout.",
      });
      expect(prayer.status).toBe("new");

      const answered = await updatePrayerRequest(prayer.id, {
        status: "answered",
      });
      expect(answered.status).toBe("answered");

      await deleteContact(contact.id);
      const deleted = await getContact(contact.id);
      expect(deleted).toBeNull();
    } finally {
      await db.delete(organizations).where(eq(organizations.id, orgId));
    }
    },
    20_000
  );
});
