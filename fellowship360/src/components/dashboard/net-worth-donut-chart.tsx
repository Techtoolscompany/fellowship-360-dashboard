"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const legendItems = [
  { label: "Outreach", color: "#d9d9d9" },
  { label: "Facilities", color: "#bbff00" },
  { label: "Tithes & Offerings", color: "#ffe500" },
  { label: "Staff", color: "#ffd966" },
];

export function NetWorthDonutChart() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
    chart: {
      type: "donut",
      fontFamily: "var(--font-plus-jakarta), sans-serif",
    },
    colors: ["#d9d9d9", "#bbff00", "#ffe500", "#ffd966", "#343330"],
    labels: ["Marketing Expenses", "Rent Fees", "Income", "Payroll", "Other"],
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "11px",
              fontWeight: 400,
              color: "#343330",
              offsetY: -8,
            },
            value: {
              show: true,
              fontSize: "22px",
              fontWeight: 600,
              color: "#343330",
              offsetY: 4,
              formatter: (val: string) =>
                "$ " + Number(val).toLocaleString(),
            },
            total: {
              show: true,
              label: "Total Ministry Budget",
              fontSize: "11px",
              fontWeight: 400,
              color: "#343330",
              formatter: (w: { globals: { seriesTotals: number[] } }) =>
                "$ " +
                w.globals.seriesTotals
                  .reduce((a: number, b: number) => a + b, 0)
                  .toLocaleString(),
            },
          },
        },
      },
    },
    stroke: { width: 2, colors: ["#f2f2f2"] },
    states: { hover: { filter: { type: "darken", value: 0.9 } } },
    tooltip: {
      enabled: true,
      y: {
        formatter: (val: number) => "$ " + val.toLocaleString(),
      },
    },
  };

  const series = [158000, 342000, 980000, 425000, 95000];

  return (
    <div className="relative h-[334px] overflow-hidden rounded-card border border-border bg-card p-4">
      <p className="text-xl font-semibold capitalize text-dark">
        Ministry Overview
      </p>

      {/* Legend */}
      <div className="relative z-10 mt-3 flex flex-col gap-2">
        {legendItems.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ background: item.color }}
            />
            <span className="text-xs capitalize text-dark/60">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Trend Badge */}
      <div className="absolute bottom-6 left-6 z-10 inline-flex items-center gap-1 rounded-pill bg-lime-400 px-3 py-0.5">
        <span className="text-xs capitalize text-dark">Increased by 12%</span>
        <ArrowUpRight className="h-3.5 w-3.5 rotate-45 text-dark" />
      </div>

      {/* Chart */}
      <div className="absolute -right-5 top-8 h-[300px] w-[300px]">
        <ReactApexChart
          options={chartOptions}
          series={series}
          type="donut"
          height={300}
        />
      </div>
    </div>
  );
}
