"use server";

import { db } from "@/db";
import { donations, pledges, churchContacts } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

// ── Donations ──
export async function getDonations(
  orgId: string,
  dateRange?: { start: Date; end: Date }
) {
  if (dateRange) {
    return await db
      .select({ donation: donations, contact: churchContacts })
      .from(donations)
      .leftJoin(churchContacts, eq(donations.contactId, churchContacts.id))
      .where(
        and(
          eq(donations.organizationId, orgId),
          gte(donations.date, dateRange.start),
          lte(donations.date, dateRange.end)
        )
      )
      .orderBy(desc(donations.date));
  }
  return await db
    .select({ donation: donations, contact: churchContacts })
    .from(donations)
    .leftJoin(churchContacts, eq(donations.contactId, churchContacts.id))
    .where(eq(donations.organizationId, orgId))
    .orderBy(desc(donations.date));
}

export async function createDonation(data: {
  contactId?: string;
  amount: number;
  date: Date;
  method?: string;
  fund?: string;
  memo?: string;
  organizationId: string;
}) {
  const [donation] = await db
    .insert(donations)
    .values({
      contactId: data.contactId ?? null,
      amount: data.amount,
      date: data.date,
      method: (data.method as any) ?? "cash",
      fund: data.fund ?? "General",
      memo: data.memo ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return donation;
}

export async function getDonationStats(orgId: string) {
  const [stats] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)`,
      totalCount: sql<number>`count(*)`,
      avgAmount: sql<number>`coalesce(avg(${donations.amount}), 0)`,
    })
    .from(donations)
    .where(eq(donations.organizationId, orgId));
  return stats;
}

// ── Pledges ──
export async function getPledges(orgId: string) {
  return await db
    .select({ pledge: pledges, contact: churchContacts })
    .from(pledges)
    .leftJoin(churchContacts, eq(pledges.contactId, churchContacts.id))
    .where(eq(pledges.organizationId, orgId))
    .orderBy(desc(pledges.createdAt));
}

export async function createPledge(data: {
  contactId?: string;
  totalAmount: number;
  frequency?: string;
  fund?: string;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  organizationId: string;
}) {
  const [pledge] = await db
    .insert(pledges)
    .values({
      contactId: data.contactId ?? null,
      totalAmount: data.totalAmount,
      frequency: (data.frequency as any) ?? "monthly",
      fund: data.fund ?? "General",
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      notes: data.notes ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return pledge;
}

export async function updatePledge(
  id: string,
  data: Partial<{
    amountPaid: number;
    notes: string | null;
  }>
) {
  const [pledge] = await db
    .update(pledges)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pledges.id, id))
    .returning();
  return pledge;
}

export async function getDonorSummary(orgId: string) {
  const donors = await db
    .select({
      contactId: donations.contactId,
      firstName: churchContacts.firstName,
      lastName: churchContacts.lastName,
      email: churchContacts.email,
      totalGiven: sql<number>`coalesce(sum(${donations.amount}), 0)`,
      donationCount: sql<number>`count(*)`,
      lastDonation: sql<Date>`max(${donations.date})`,
    })
    .from(donations)
    .leftJoin(churchContacts, eq(donations.contactId, churchContacts.id))
    .where(eq(donations.organizationId, orgId))
    .groupBy(
      donations.contactId,
      churchContacts.firstName,
      churchContacts.lastName,
      churchContacts.email
    )
    .orderBy(sql`sum(${donations.amount}) desc`);
  return donors;
}
