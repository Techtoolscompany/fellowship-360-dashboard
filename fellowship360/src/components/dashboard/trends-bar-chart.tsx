"use client";

import dynamic from "next/dynamic";
import { ChevronDown } from "lucide-react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export function TrendsBarChart() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
    chart: {
      type: "bar",
      fontFamily: "var(--font-plus-jakarta), sans-serif",
      toolbar: { show: false },
    },
    colors: [
      "#343330",
      "#343330",
      "#343330",
      "#bbff00",
      "#b2b2b2",
      "#b2b2b2",
      "#b2b2b2",
    ],
    plotOptions: {
      bar: {
        borderRadius: 8,
        borderRadiusApplication: "end",
        columnWidth: "16px",
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: { show: false },
    xaxis: {
      categories: ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat", "Sun"],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { fontSize: "16px", fontWeight: 400, colors: "#343330" },
      },
    },
    yaxis: { show: false },
    tooltip: {
      enabled: true,
      custom: ({
        series,
        seriesIndex,
        dataPointIndex,
      }: {
        series: number[][];
        seriesIndex: number;
        dataPointIndex: number;
      }) => {
        const value = series[seriesIndex][dataPointIndex];
        return `<div style="background:#bbff00;padding:4px 12px;border-radius:360px;font-size:14px;font-weight:500;color:#000329;">$${value.toLocaleString()}</div>`;
      },
    },
    states: { hover: { filter: { type: "darken", value: 0.9 } } },
  };

  const series = [{ name: "Engagement", data: [86, 94, 122, 160, 117, 130, 141] }];

  return (
    <div className="h-[334px] overflow-hidden rounded-card border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xl font-semibold capitalize text-dark">
            Engagement Trends
          </p>
          <p className="text-xs text-dark/60">
            Your attendance increased by 20% this week.
          </p>
        </div>
        <button className="flex items-center gap-1 rounded-pill border-none bg-lime-400 px-3 py-1 text-sm text-dark">
          Week
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 h-[217px]">
        <ReactApexChart
          options={chartOptions}
          series={series}
          type="bar"
          height={200}
        />
      </div>
    </div>
  );
}
