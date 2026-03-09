"use server";

import { db } from "@/db";
import { smsDevices } from "@/db/schema/sms-gateway";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { organizationMemberships } from "@/db/schema/organization-membership";

async function requireOrgMembership(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [member] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, session.user.id),
        eq(organizationMemberships.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!member) throw new Error("Forbidden");
  return { userId: session.user.id, role: member.role };
}

export async function getAssignedSmsDevice(orgId: string) {
  await requireOrgMembership(orgId);

  const [device] = await db
    .select({
      id: smsDevices.id,
      deviceName: smsDevices.deviceName,
      phoneNumber: smsDevices.phoneNumber,
      isActive: smsDevices.isActive,
      lastSeenAt: smsDevices.lastSeenAt,
    })
    .from(smsDevices)
    .where(eq(smsDevices.organizationId, orgId))
    .limit(1);

  return device || null;
}
