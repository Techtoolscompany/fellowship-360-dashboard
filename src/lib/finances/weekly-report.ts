import { db } from "@/db";
import { donations } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { endOfWeek, startOfWeek, subWeeks } from "date-fns";

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

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

export type WeeklyGivingReport = {
  period: {
    start: string;
    end: string;
    label: string;
  };
  previousPeriod: {
    start: string;
    end: string;
    label: string;
  };
  totals: {
    current: number;
    previous: number;
    currentCount: number;
    previousCount: number;
    varianceAmount: number;
    variancePercent: number;
    trend: "up" | "down" | "flat";
  };
  breakdownBySource: Array<{
    source: WeeklyGivingSource;
    total: number;
    count: number;
    sharePercent: number;
  }>;
  breakdownByFund: Array<{
    fund: string;
    category: WeeklyGivingCategory;
    total: number;
    count: number;
    sharePercent: number;
  }>;
  breakdownByCategory: Array<{
    category: WeeklyGivingCategory;
    total: number;
    count: number;
    sharePercent: number;
  }>;
  summary: string;
  generatedAt: string;
};

export async function computeWeeklyGivingReport(input: {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<WeeklyGivingReport> {
  const now = new Date();
  const currentStart = input.startDate ?? startOfWeek(now, { weekStartsOn: 0 });
  const currentEnd = input.endDate ?? endOfWeek(now, { weekStartsOn: 0 });

  if (currentEnd.getTime() < currentStart.getTime()) {
    throw new Error("endDate must be after startDate");
  }

  let previousStart: Date;
  let previousEnd: Date;

  if (input.startDate || input.endDate) {
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
          eq(donations.organizationId, input.organizationId),
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
          eq(donations.organizationId, input.organizationId),
          gte(donations.date, previousStart),
          lte(donations.date, previousEnd)
        )
      ),
  ]);

  const sourceTotals = new Map<WeeklyGivingSource, { total: number; count: number }>();
  const fundTotals = new Map<
    string,
    { total: number; count: number; category: WeeklyGivingCategory }
  >();
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
