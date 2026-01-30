"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export function NetWorthLineChart() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = {
    chart: {
      type: "line",
      fontFamily: "var(--font-plus-jakarta), sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#343330", "#bbff00"],
    stroke: { width: [2, 2], curve: "smooth" },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: "#e9e9e9",
      strokeDashArray: 5,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    xaxis: {
      categories: [
        "Feb 14",
        "Feb 14",
        "Feb 16",
        "Feb 18",
        "Feb 19",
        "Feb 20",
        "Feb 17",
      ],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: "12px",
          fontWeight: 400,
          colors: "#343330",
        },
        offsetY: 5,
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          fontWeight: 400,
          colors: "#343330",
        },
        formatter: (val: number) => (val >= 1000 ? val / 1000 + "k" : String(val)),
      },
      min: 0,
      max: 20000,
      tickAmount: 4,
    },
    markers: {
      size: [0, 4],
      colors: ["#343330", "#bbff00"],
      strokeColors: ["#343330", "#bbff00"],
      strokeWidth: 2,
      hover: { size: 6 },
    },
    tooltip: {
      shared: true,
      custom: ({
        series,
      }: {
        series: number[][];
        seriesIndex: number;
        dataPointIndex: number;
      }) => {
        const attendance = series[0]?.[0] ?? 0;
        const online = series[1]?.[0] ?? 0;
        return `
          <div style="background:white;border:1px solid #d9d9d9;border-radius:8px;padding:8px 12px;box-shadow:0 1px 4px rgba(12,12,13,0.1);">
            <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
              <span style="width:3px;height:3px;background:#343330;border-radius:50%;"></span>
              <span style="font-size:12px;font-weight:600;color:#343330;">Attendance:</span>
              <span style="font-size:12px;color:#343330;">${attendance.toLocaleString()}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="width:3px;height:3px;background:#bbff00;border-radius:50%;"></span>
              <span style="font-size:12px;font-weight:600;color:#343330;">Online:</span>
              <span style="font-size:12px;color:#343330;">${online.toLocaleString()}</span>
            </div>
          </div>`;
      },
    },
  };

  const series = [
    { name: "Attendance", data: [8500, 9200, 11000, 11645, 10800, 9500, 8800] },
    { name: "Online Views", data: [5200, 5800, 7200, 6251, 6800, 7500, 8200] },
  ];

  return (
    <div className="h-[334px] overflow-hidden rounded-card border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xl font-semibold capitalize text-dark">
          Weekly Attendance
        </p>
        <div className="flex items-center gap-1 rounded-pill bg-lime-400 px-3 py-1">
          <ArrowUpRight className="h-4 w-4 text-dark" />
          <span className="text-base font-medium capitalize text-dark">
            50%
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="-mt-5 h-[240px]">
        <ReactApexChart
          options={chartOptions}
          series={series}
          type="line"
          height={240}
        />
      </div>
    </div>
  );
}
