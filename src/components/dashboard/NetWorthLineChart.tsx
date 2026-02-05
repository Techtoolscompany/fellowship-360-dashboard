"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FiArrowUpRight } from "react-icons/fi";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const NetWorthLineChart = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDark(
        document.documentElement.classList.contains("dark") ||
        document.documentElement.classList.contains("app-skin-dark")
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const lineColor = isDark ? "#94a3b8" : "#343330";
  const labelColor = isDark ? "#94a3b8" : "#343330";
  const gridColor = isDark ? "#1e3048" : "#e9e9e9";
  const tooltipBg = isDark ? "#1e293b" : "white";
  const tooltipBorder = isDark ? "#334155" : "#d9d9d9";
  const tooltipText = isDark ? "#e2e8f0" : "#343330";

  const chartOptions: any = {
    chart: {
      type: "line",
      fontFamily: "Plus Jakarta Sans, sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
    },
    colors: [lineColor, "#bbff00"],
    stroke: { width: [2, 2], curve: "smooth" },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 5,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    xaxis: {
      categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: "12px",
          fontWeight: 400,
          colors: labelColor,
          fontFamily: "Inter, sans-serif",
        },
        offsetY: 5,
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          fontWeight: 400,
          colors: labelColor,
          fontFamily: "Inter, sans-serif",
        },
        formatter: (val: number) =>
          val >= 1000 ? val / 1000 + "k" : val,
      },
      min: 0,
      max: 20000,
      tickAmount: 4,
    },
    markers: {
      size: [0, 4],
      colors: [lineColor, "#bbff00"],
      strokeColors: [lineColor, "#bbff00"],
      strokeWidth: 2,
      hover: { size: 6 },
    },
    tooltip: {
      shared: true,
      custom: function ({ series, seriesIndex, dataPointIndex }: any) {
        const attendance = series[0][dataPointIndex];
        const online = series[1][dataPointIndex];
        return `
                <div style="
                    background: ${tooltipBg};
                    border: 1px solid ${tooltipBorder};
                    border-radius: 8px;
                    padding: 8px 12px;
                    box-shadow: 0 1px 4px rgba(12,12,13,0.1);
                ">
                    <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                        <span style="width: 6px; height: 6px; background: ${lineColor}; border-radius: 50%;"></span>
                        <span style="font-size: 12px; font-weight: 600; color: ${tooltipText};">Attendance:</span>
                        <span style="font-size: 12px; color: ${tooltipText};">${
          attendance?.toLocaleString() || 0
        }</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="width: 6px; height: 6px; background: #bbff00; border-radius: 50%;"></span>
                        <span style="font-size: 12px; font-weight: 600; color: ${tooltipText};">Online:</span>
                        <span style="font-size: 12px; color: ${tooltipText};">${
          online?.toLocaleString() || 0
        }</span>
                    </div>
                </div>`;
      },
    },
  };

  const series = [
    {
      name: "Attendance",
      data: [8500, 9200, 11000, 11645, 10800, 9500, 8800],
    },
    {
      name: "Online Views",
      data: [5200, 5800, 7200, 6251, 6800, 7500, 8200],
    },
  ];

  return (
    <div className="w-full h-full">
      <div
        className="bg-card w-full h-full"
        style={{
          borderRadius: "24px",
          overflow: "hidden",
          border: "1px solid var(--ds-border-secondary, #e2e8f0)",
          minHeight: "334px",
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p
              className="mb-0"
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--ds-text-primary, #343330)",
                lineHeight: "28px",
                textTransform: "capitalize",
              }}
            >
              Weekly Attendance
            </p>
            <div
              className="flex items-center gap-1"
              style={{
                padding: "4px 12px",
                background: "#bbff00",
                borderRadius: "360px",
              }}
            >
              <FiArrowUpRight size={16} color="#000329" />
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#000329",
                  textTransform: "capitalize",
                }}
              >
                50%
              </span>
            </div>
          </div>

          {/* Chart */}
          <div style={{ height: "240px", marginTop: "-20px" }}>
            <ReactApexChart
              key={isDark ? "dark" : "light"}
              options={chartOptions}
              series={series}
              type="line"
              height={240}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetWorthLineChart;
