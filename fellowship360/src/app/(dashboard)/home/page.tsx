"use client";

import {
  KpiStripCard,
  NetWorthDonutChart,
  TrendsBarChart,
  HighlightPromoCard,
  TransactionHistoryCard,
  DebtStatusCard,
  NetWorthLineChart,
  ThisMonthCard,
} from "@/components/dashboard";

export default function HomePage() {
  return (
    <div>
      {/* Title Section */}
      <div className="mb-6">
        <p className="mb-1 text-base text-muted-foreground">
          Manage Your Church with Precision
        </p>
        <h1 className="text-[32px] font-semibold text-dark">
          Ministry Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* KPI Strip - Full Width */}
        <div className="col-span-12">
          <KpiStripCard />
        </div>

        {/* Row 1: Donut + Bar + Promo */}
        <div className="col-span-12 xl:col-span-4">
          <NetWorthDonutChart />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <TrendsBarChart />
        </div>
        <div className="col-span-12 xl:col-span-4">
          <HighlightPromoCard />
        </div>

        {/* Row 2: Debt + Line Chart + This Week + Transactions */}
        <div className="col-span-12 xl:col-span-3">
          <DebtStatusCard />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <NetWorthLineChart />
        </div>
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
          <ThisMonthCard />
          <TransactionHistoryCard />
        </div>
      </div>
    </div>
  );
}
