"use server";

import { db } from "@/db";
import {
  churchContacts,
  volunteers,
  organizationMemberships,
  users,
} from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { requireOrgMembership } from "./utils";
import { getServiceSchedulingMatrix } from "./operations";

export async function getPeopleOverview(orgId: string) {
  await requireOrgMembership(orgId);

  const [members, volunteerRoster, paidStaff, schedulingMatrix] = await Promise.all([
    db
      .select({
        id: churchContacts.id,
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
        phone: churchContacts.phone,
        memberStatus: churchContacts.memberStatus,
        createdAt: churchContacts.createdAt,
      })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, orgId),
          or(
            eq(churchContacts.memberStatus, "member"),
            eq(churchContacts.memberStatus, "leader"),
            eq(churchContacts.memberStatus, "regular_attendee")
          )
        )
      )
      .orderBy(desc(churchContacts.createdAt))
      .limit(12),
    db
      .select({
        volunteerId: volunteers.id,
        role: volunteers.role,
        status: volunteers.status,
        joinedAt: volunteers.joinedAt,
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
        phone: churchContacts.phone,
      })
      .from(volunteers)
      .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
      .where(eq(volunteers.organizationId, orgId))
      .orderBy(desc(volunteers.joinedAt))
      .limit(12),
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, orgId))
      .orderBy(users.name, users.email)
      .limit(12),
    getServiceSchedulingMatrix(orgId),
  ]);

  return {
    summary: {
      members: schedulingMatrix.summary.members,
      volunteers: schedulingMatrix.summary.volunteers,
      paidStaff: schedulingMatrix.summary.paidStaff,
      schedulable: schedulingMatrix.summary.schedulable,
      withAvailability: schedulingMatrix.summary.withAvailability,
    },
    members,
    volunteers: volunteerRoster,
    paidStaff,
  };
}
