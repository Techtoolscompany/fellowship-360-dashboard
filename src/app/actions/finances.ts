"use server";

import { db } from "@/db";
import { donations, pledges, churchContacts } from "@/db/schema";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { requireOrgMembership, auditAction } from "./utils";
import * as z from "zod";
import { organizations } from "@/db/schema/organization";
import sendMail from "@/lib/email/sendMail";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function deliverDonationReceipt(params: {
  organizationId: string;
  donationId: string;
  contactId: string;
  amount: number;
  date: Date;
  fund: string;
  method: string;
}) {
  const [org, contact] = await Promise.all([
    db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, params.organizationId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
      })
      .from(churchContacts)
      .where(eq(churchContacts.id, params.contactId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!org || !contact?.email) {
    return { sent: false as const, reason: "missing-org-or-contact-email" };
  }

  const donorName = `${contact.firstName} ${contact.lastName}`.trim();
  const churchName = org.name;
  const amountText = formatCurrency(params.amount);
  const dateText = params.date.toLocaleDateString("en-US");
  const subject = `${churchName} Donation Receipt — ${amountText}`;

  const html = `
    <p>Hi ${donorName || "there"},</p>
    <p>Thank you for your generous gift to <strong>${churchName}</strong>.</p>
    <p>This email is your receipt for your records.</p>
    <ul>
      <li><strong>Amount:</strong> ${amountText}</li>
      <li><strong>Date:</strong> ${dateText}</li>
      <li><strong>Fund:</strong> ${params.fund}</li>
      <li><strong>Method:</strong> ${params.method}</li>
      <li><strong>Receipt ID:</strong> ${params.donationId}</li>
    </ul>
    <p>No goods or services were provided in exchange for this contribution unless explicitly noted by the church.</p>
    <p>Grace and peace,<br/>${churchName}</p>
  `.trim();

  await sendMail(contact.email, subject, html);

  await db
    .update(donations)
    .set({ receiptSent: true })
    .where(
      and(
        eq(donations.id, params.donationId),
        eq(donations.organizationId, params.organizationId)
      )
    );

  return { sent: true as const };
}

// ── Donations ──
const DONATIONS_PAGE_SIZE = 50;

export async function getDonations(
  orgId: string,
  dateRange?: { start: Date; end: Date },
  page = 1
) {
  await requireOrgMembership(orgId);
  const offset = (page - 1) * DONATIONS_PAGE_SIZE;
  const conditions = dateRange
    ? and(
        eq(donations.organizationId, orgId),
        gte(donations.date, dateRange.start),
        lte(donations.date, dateRange.end)
      )
    : eq(donations.organizationId, orgId);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ donation: donations, contact: churchContacts })
      .from(donations)
      .leftJoin(churchContacts, eq(donations.contactId, churchContacts.id))
      .where(conditions)
      .orderBy(desc(donations.date))
      .limit(DONATIONS_PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(donations).where(conditions),
  ]);

  return {
    donations: rows,
    total,
    page,
    pageSize: DONATIONS_PAGE_SIZE,
    pageCount: Math.ceil(total / DONATIONS_PAGE_SIZE),
  };
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
  const parsed = z.object({
    contactId: z.string().optional(),
    amount: z.coerce.number().positive(),
    date: z.coerce.date(),
    method: z.string().optional(),
    fund: z.string().optional(),
    memo: z.string().optional(),
    organizationId: z.string().min(1),
  }).parse(data);

  const session = await requireOrgMembership(parsed.organizationId, "admin");
  const [donation] = await db
    .insert(donations)
    .values({
      contactId: parsed.contactId ?? null,
      amount: parsed.amount,
      date: parsed.date,
      method: (parsed.method as any) ?? "cash",
      fund: parsed.fund ?? "General",
      memo: parsed.memo ?? null,
      organizationId: parsed.organizationId,
    })
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "donation",
    entityId: donation.id,
    details: { amount: parsed.amount, fund: parsed.fund }
  });

  // If donation is linked to a contact with an email, send receipt immediately.
  if (donation.contactId) {
    try {
      await deliverDonationReceipt({
        organizationId: parsed.organizationId,
        donationId: donation.id,
        contactId: donation.contactId,
        amount: parsed.amount,
        date: parsed.date,
        fund: parsed.fund ?? "General",
        method: parsed.method ?? "cash",
      });
    } catch (error) {
      console.error("Failed to send donation receipt:", error);
      // Non-blocking for donation creation. Receipt can be resent manually.
    }
  }

  return donation;
}

export async function getDonationStats(orgId: string) {
  await requireOrgMembership(orgId);
  const [stats] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${donations.amount}), 0)`,
      totalCount: sql<number>`count(*)`,
      avgAmount: sql<number>`coalesce(avg(${donations.amount}), 0)`,
      uniqueDonorCount: sql<number>`count(distinct ${donations.contactId})`,
    })
    .from(donations)
    .where(eq(donations.organizationId, orgId));
  return stats;
}

// ── Pledges ──
export async function getPledges(orgId: string) {
  await requireOrgMembership(orgId);
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
  const parsed = z.object({
    contactId: z.string().optional(),
    totalAmount: z.coerce.number().positive(),
    frequency: z.string().optional(),
    fund: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    notes: z.string().optional(),
    organizationId: z.string().min(1),
  }).parse(data);

  const session = await requireOrgMembership(parsed.organizationId, "admin");
  const [pledge] = await db
    .insert(pledges)
    .values({
      contactId: parsed.contactId ?? null,
      totalAmount: parsed.totalAmount,
      frequency: (parsed.frequency as any) ?? "monthly",
      fund: parsed.fund ?? "General",
      startDate: parsed.startDate,
      endDate: parsed.endDate ?? null,
      notes: parsed.notes ?? null,
      organizationId: parsed.organizationId,
    })
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "pledge",
    entityId: pledge.id,
    details: { totalAmount: parsed.totalAmount, fund: parsed.fund }
  });

  return pledge;
}

export async function updatePledge(
  id: string,
  data: Partial<{
    contactId: string | null;
    totalAmount: number;
    amountPaid: number;
    frequency: string;
    fund: string;
    startDate: Date;
    endDate: Date | null;
    notes: string | null;
  }>
) {
  const [existing] = await db.select().from(pledges).where(eq(pledges.id, id));
  if (!existing) throw new Error("Pledge not found");
  const session = await requireOrgMembership(existing.organizationId, "admin");

  const [pledge] = await db
    .update(pledges)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(pledges.id, id))
    .returning();

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "pledge",
    entityId: pledge.id,
    details: { updatedFields: Object.keys(data) }
  });

  return pledge;
}

export async function getDonorSummary(orgId: string) {
  await requireOrgMembership(orgId);
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

export async function resendDonationReceipt(donationId: string) {
  const [donation] = await db
    .select()
    .from(donations)
    .where(eq(donations.id, donationId))
    .limit(1);

  if (!donation) {
    throw new Error("Donation not found");
  }

  await requireOrgMembership(donation.organizationId, "admin");

  if (!donation.contactId) {
    throw new Error("Cannot send receipt for anonymous donation");
  }

  return deliverDonationReceipt({
    organizationId: donation.organizationId,
    donationId: donation.id,
    contactId: donation.contactId,
    amount: Number(donation.amount),
    date: donation.date,
    fund: donation.fund ?? "General",
    method: donation.method ?? "cash",
  });
}

export async function sendYearEndGivingStatement(input: {
  organizationId: string;
  contactId: string;
  year: number;
}) {
  const parsed = z.object({
    organizationId: z.string().min(1),
    contactId: z.string().min(1),
    year: z.number().int().gte(2000).lte(3000),
  }).parse(input);

  await requireOrgMembership(parsed.organizationId, "admin");

  const start = new Date(Date.UTC(parsed.year, 0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(parsed.year + 1, 0, 1, 0, 0, 0));

  const [org, contact, rows] = await Promise.all([
    db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, parsed.organizationId))
      .limit(1)
      .then((result) => result[0]),
    db
      .select({
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
      })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.id, parsed.contactId),
          eq(churchContacts.organizationId, parsed.organizationId)
        )
      )
      .limit(1)
      .then((result) => result[0]),
    db
      .select({
        id: donations.id,
        amount: donations.amount,
        date: donations.date,
        fund: donations.fund,
        method: donations.method,
      })
      .from(donations)
      .where(
        and(
          eq(donations.organizationId, parsed.organizationId),
          eq(donations.contactId, parsed.contactId),
          gte(donations.date, start),
          lte(donations.date, new Date(end.getTime() - 1))
        )
      )
      .orderBy(donations.date),
  ]);

  if (!org) throw new Error("Organization not found");
  if (!contact?.email) throw new Error("Contact email is required for statement delivery");
  if (rows.length === 0) throw new Error(`No donations found for ${parsed.year}`);

  const donorName = `${contact.firstName} ${contact.lastName}`.trim();
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  const donationRows = rows
    .map((row) => {
      const date = row.date.toLocaleDateString("en-US");
      const amount = formatCurrency(Number(row.amount));
      return `<tr>
        <td style="padding: 6px 10px; border: 1px solid #e5e7eb;">${date}</td>
        <td style="padding: 6px 10px; border: 1px solid #e5e7eb;">${row.fund ?? "General"}</td>
        <td style="padding: 6px 10px; border: 1px solid #e5e7eb;">${row.method ?? "other"}</td>
        <td style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: right;">${amount}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <p>Hi ${donorName || "there"},</p>
    <p>Thank you for your faithful generosity. Your ${parsed.year} giving statement for <strong>${org.name}</strong> is below.</p>
    <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
      <thead>
        <tr>
          <th style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: left;">Date</th>
          <th style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: left;">Fund</th>
          <th style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: left;">Method</th>
          <th style="padding: 6px 10px; border: 1px solid #e5e7eb; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>${donationRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: right;"><strong>Total</strong></td>
          <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: right;"><strong>${formatCurrency(totalAmount)}</strong></td>
        </tr>
      </tfoot>
    </table>
    <p>No goods or services were provided in exchange for these contributions unless explicitly noted by the church.</p>
    <p>Grace and peace,<br/>${org.name}</p>
  `.trim();

  await sendMail(
    contact.email,
    `${org.name} ${parsed.year} Giving Statement`,
    html
  );

  return {
    sent: true,
    contactEmail: contact.email,
    donationCount: rows.length,
    totalAmount,
  };
}
