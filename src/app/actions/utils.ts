import { auth } from "@/auth";
import { db } from "@/db";
import { actionAuditLogs, organizationMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import * as z from "zod";

const organizationIdSchema = z.string().trim().min(1);
const requiredRoleSchema = z.enum(["admin", "user"]).optional();
const auditActionSchema = z.object({
  organizationId: organizationIdSchema,
  userId: z.string().trim().min(1),
  actionType: z.string().trim().min(1),
  entityName: z.string().trim().min(1),
  entityId: z.string().trim().min(1).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function requireOrgMembership(organizationId: string, requiredRole?: "admin" | "user") {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  const parsedRequiredRole = requiredRoleSchema.parse(requiredRole);
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const [member] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, session.user.id),
        eq(organizationMemberships.organizationId, parsedOrganizationId)
      )
    );

  if (!member) {
    throw new Error("Not a member of this organization");
  }

  if (
    parsedRequiredRole === "admin" &&
    member.role !== "admin" &&
    member.role !== "owner"
  ) {
    throw new Error("Insufficient permissions: requires admin role");
  }

  return { userId: session.user.id, role: member.role };
}

export async function auditAction(params: {
  organizationId: string;
  userId: string;
  actionType: string;
  entityName: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const parsed = auditActionSchema.parse(params);
    await db.insert(actionAuditLogs).values(parsed);
  } catch (error) {
    console.error("Failed to insert audit log:", error);
  }
}
