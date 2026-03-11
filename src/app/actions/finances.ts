"use server";

import { db } from "@/db";
import { donations, pledges, churchContacts } from "@/db/schema";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { requireOrgMembership, auditAction } from "./utils";
import * as z from "zod";
import { organizations } from "@/db/schema/organization";
import sendMail from "@/lib/email/sendMail";
import { endOfWeek, startOfWeek, subWeeks } from "date-fns";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const WEEKLY_SOURCE_ORDER = [
  "cash",
  "check",
  "online",
  "text",
  "app",
  "manual",
] as const;

type WeeklyGivingSource = (typeof WEEKLY_SOURCE_ORDER)[number];
type WeeklyGivingCategory = "General" | "Missions" | "Building";

function normalizeWeeklySource(
  method: string | null | undefined,
  memo: string | null | undefined
): WeeklyGivingSource {
  const normalizedMethod = (method ?? "other").toLowerCase();
  const normalizedMemo = (memo ?? "").toLowerCase();

  const memoHintsText = normalizedMemo.includes("text") || normalizedMemo.includes("sms");
  const memoHintsApp =
    normalizedMemo.includes("app") ||
    normalizedMemo.includes("mobile") ||
    normalizedMemo.includes("pushpay");

  if (normalizedMethod === "cash") return "cash";
  if (normalizedMethod === "check") return "check";

  if (normalizedMethod === "online") {
    if (memoHintsText) return "text";
    if (memoHintsApp) return "app";
    return "online";
  }

  if (normalizedMethod === "card") {
    if (memoHintsText) return "text";
    return "app";
  }

  if (normalizedMethod === "bank_transfer") return "online";
  if (memoHintsText) return "text";
  if (memoHintsApp) return "app";
  return "manual";
}

function categorizeFund(fund: string): WeeklyGivingCategory {
  const normalized = fund.toLowerCase();
  if (normalized.includes("mission")) return "Missions";
  if (normalized.includes("build") || normalized.includes("capital")) return "Building";
  return "General";
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function formatDateRangeLabel(start: Date, end: Date) {
  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
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

export async function getWeeklyGivingReport(input: {
  organizationId: string;
  startDate?: Date | string;
  endDate?: Date | string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .parse(input);

  await requireOrgMembership(parsed.organizationId);

  const now = new Date();
  const currentStart = parsed.startDate ?? startOfWeek(now, { weekStartsOn: 0 });
  const currentEnd = parsed.endDate ?? endOfWeek(now, { weekStartsOn: 0 });

  if (currentEnd.getTime() < currentStart.getTime()) {
    throw new Error("endDate must be after startDate");
  }

  let previousStart: Date;
  let previousEnd: Date;

  if (parsed.startDate || parsed.endDate) {
    const spanMs = currentEnd.getTime() - currentStart.getTime();
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(previousEnd.getTime() - spanMs);
  } else {
    const previousWeek = subWeeks(now, 1);
    previousStart = startOfWeek(previousWeek, { weekStartsOn: 0 });
    previousEnd = endOfWeek(previousWeek, { weekStartsOn: 0 });
  }

  const [currentRows, [previousSummary]] = await Promise.all([
    db
      .select({
        id: donations.id,
        amount: donations.amount,
        method: donations.method,
        fund: donations.fund,
        memo: donations.memo,
      })
      .from(donations)
      .where(
        and(
          eq(donations.organizationId, parsed.organizationId),
          gte(donations.date, currentStart),
          lte(donations.date, currentEnd)
        )
      ),
    db
      .select({
        total: sql<number>`coalesce(sum(${donations.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(donations)
      .where(
        and(
          eq(donations.organizationId, parsed.organizationId),
          gte(donations.date, previousStart),
          lte(donations.date, previousEnd)
        )
      ),
  ]);

  const sourceTotals = new Map<WeeklyGivingSource, { total: number; count: number }>();
  const fundTotals = new Map<string, { total: number; count: number; category: WeeklyGivingCategory }>();
  const categoryTotals = new Map<WeeklyGivingCategory, { total: number; count: number }>();

  for (const source of WEEKLY_SOURCE_ORDER) {
    sourceTotals.set(source, { total: 0, count: 0 });
  }
  for (const category of ["General", "Missions", "Building"] as const) {
    categoryTotals.set(category, { total: 0, count: 0 });
  }

  let currentTotal = 0;
  let currentCount = 0;

  for (const row of currentRows) {
    const amount = Number(row.amount ?? 0);
    const source = normalizeWeeklySource(row.method, row.memo);
    const fund = (row.fund ?? "General").trim() || "General";
    const category = categorizeFund(fund);

    currentTotal += amount;
    currentCount += 1;

    const sourceBucket = sourceTotals.get(source) ?? { total: 0, count: 0 };
    sourceBucket.total += amount;
    sourceBucket.count += 1;
    sourceTotals.set(source, sourceBucket);

    const fundBucket = fundTotals.get(fund) ?? { total: 0, count: 0, category };
    fundBucket.total += amount;
    fundBucket.count += 1;
    fundTotals.set(fund, fundBucket);

    const categoryBucket = categoryTotals.get(category) ?? { total: 0, count: 0 };
    categoryBucket.total += amount;
    categoryBucket.count += 1;
    categoryTotals.set(category, categoryBucket);
  }

  const previousTotal = Number(previousSummary?.total ?? 0);
  const previousCount = Number(previousSummary?.count ?? 0);
  const varianceAmount = Number((currentTotal - previousTotal).toFixed(2));
  const variancePercent =
    previousTotal <= 0
      ? currentTotal > 0
        ? 100
        : 0
      : Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1));

  const trend: "up" | "down" | "flat" =
    Math.abs(varianceAmount) < 0.01 ? "flat" : varianceAmount > 0 ? "up" : "down";

  const breakdownBySource = WEEKLY_SOURCE_ORDER.map((source) => {
    const bucket = sourceTotals.get(source) ?? { total: 0, count: 0 };
    return {
      source,
      total: Number(bucket.total.toFixed(2)),
      count: bucket.count,
      sharePercent: toPercent(bucket.total, currentTotal),
    };
  });

  const breakdownByFund = Array.from(fundTotals.entries())
    .map(([fund, bucket]) => ({
      fund,
      category: bucket.category,
      total: Number(bucket.total.toFixed(2)),
      count: bucket.count,
      sharePercent: toPercent(bucket.total, currentTotal),
    }))
    .sort((a, b) => b.total - a.total);

  const breakdownByCategory = (["General", "Missions", "Building"] as const).map(
    (category) => {
      const bucket = categoryTotals.get(category) ?? { total: 0, count: 0 };
      return {
        category,
        total: Number(bucket.total.toFixed(2)),
        count: bucket.count,
        sharePercent: toPercent(bucket.total, currentTotal),
      };
    }
  );

  const topSource = breakdownBySource
    .slice()
    .sort((a, b) => b.total - a.total)
    .find((row) => row.total > 0);
  const topFund = breakdownByFund[0];

  const summaryParts = [
    `Weekly giving (${formatDateRangeLabel(currentStart, currentEnd)}) totaled ${formatCurrency(currentTotal)} across ${currentCount} donation${currentCount === 1 ? "" : "s"}.`,
    trend === "flat"
      ? "No week-over-week change compared with the prior week."
      : `${trend === "up" ? "Up" : "Down"} ${Math.abs(variancePercent).toFixed(1)}% vs prior week (${formatCurrency(previousTotal)}).`,
  ];

  if (topSource) {
    summaryParts.push(
      `Top source: ${topSource.source} at ${formatCurrency(topSource.total)} (${topSource.sharePercent.toFixed(1)}%).`
    );
  }
  if (topFund) {
    summaryParts.push(
      `Top fund: ${topFund.fund} [${topFund.category}] at ${formatCurrency(topFund.total)}.`
    );
  }

  return {
    period: {
      start: currentStart.toISOString(),
      end: currentEnd.toISOString(),
      label: formatDateRangeLabel(currentStart, currentEnd),
    },
    previousPeriod: {
      start: previousStart.toISOString(),
      end: previousEnd.toISOString(),
      label: formatDateRangeLabel(previousStart, previousEnd),
    },
    totals: {
      current: Number(currentTotal.toFixed(2)),
      previous: Number(previousTotal.toFixed(2)),
      currentCount,
      previousCount,
      varianceAmount,
      variancePercent,
      trend,
    },
    breakdownBySource,
    breakdownByFund,
    breakdownByCategory,
    summary: summaryParts.join(" "),
    generatedAt: new Date().toISOString(),
  };
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
