import { auth } from "@/auth";
import { db } from "@/db";
import { organizationMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function requireOrgMembership(organizationId: string, requiredRole?: "admin" | "user") {
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
        eq(organizationMemberships.organizationId, organizationId)
      )
    );

  if (!member) {
    throw new Error("Not a member of this organization");
  }

  if (
    requiredRole === "admin" &&
    member.role !== "admin" &&
    member.role !== "owner"
  ) {
    throw new Error("Insufficient permissions: requires admin role");
  }

  return { userId: session.user.id, role: member.role };
}

import { actionAuditLogs } from "@/db/schema";

export async function auditAction(params: {
  organizationId: string;
  userId: string;
  actionType: string;
  entityName: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(actionAuditLogs).values(params);
  } catch (error) {
    console.error("Failed to insert audit log:", error);
  }
}
