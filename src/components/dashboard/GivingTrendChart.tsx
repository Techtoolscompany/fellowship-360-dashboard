"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const GivingTrendChart = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Basic dark mode check logic - adapted from Duralux but checking html class
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const lineColor = "#bbff00";
  const textColor = isDark ? "#94a3b8" : "#343330";
  const gridColor = isDark ? "#334155" : "#e5e7eb";

  // Weekly giving data for past 4 weeks
  const weeklyData = [
    { week: "Week 1", amount: 4250 },
    { week: "Week 2", amount: 5120 },
    { week: "Week 3", amount: 4890 },
    { week: "Week 4", amount: 4832 },
  ];

  const totalGiving = weeklyData.reduce((sum, w) => sum + w.amount, 0);
  const lastWeekChange = (
    ((weeklyData[3].amount - weeklyData[2].amount) / weeklyData[2].amount) *
    100
  ).toFixed(1);
  const isPositive = parseFloat(lastWeekChange) >= 0;

  // Type assertion for options as 'any' to avoid strict TS conflicts with ApexCharts types for this 1:1 port
  const chartOptions: any = {
    chart: {
      type: "area",
      fontFamily: "Plus Jakarta Sans, sans-serif",
      toolbar: { show: false },
      sparkline: { enabled: false },
      background: "transparent",
    },
    colors: [lineColor],
    stroke: {
      curve: "smooth",
      width: 3,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 100],
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      categories: weeklyData.map((w) => w.week),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: "12px",
          fontWeight: 400,
          colors: textColor,
        },
      },
    },
    yaxis: {
      show: true,
      labels: {
        style: {
          fontSize: "11px",
          colors: textColor,
        },
        formatter: (val: number) => "$" + (val / 1000).toFixed(1) + "k",
      },
    },
    tooltip: {
      enabled: true,
      theme: isDark ? "dark" : "light",
      y: { formatter: (val: number) => "$" + val.toLocaleString() },
    },
    markers: {
      size: 4,
      colors: ["#fff"],
      strokeColors: lineColor,
      strokeWidth: 2,
      hover: { size: 6 },
    },
  };

  const series = [
    {
      name: "Weekly Giving",
      data: weeklyData.map((w) => w.amount),
    },
  ];

  return (
    <div className="w-full">
      <div
        className="bg-card border border-border"
        style={{
          borderRadius: "12px", // Matching visual rounded-xl
          overflow: "hidden",
          height: "334px",
        }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p
                className="mb-1"
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: isDark ? "#fff" : "var(--ds-text-primary, #343330)",
                  lineHeight: "28px",
                }}
              >
                Giving Trends
              </p>
              <p
                className="mb-0"
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "var(--ds-text-secondary, #64748b)",
                }}
              >
                Week-to-week giving over past 4 weeks
              </p>
            </div>
            <div
              className="flex items-center gap-1"
              style={{
                padding: "4px 12px",
                background: isPositive ? "#dcfce7" : "#fee2e2",
                borderRadius: "360px",
                fontSize: "13px",
                fontWeight: 500,
                color: isPositive ? "#16a34a" : "#dc2626",
              }}
            >
              {isPositive ? (
                <FiTrendingUp size={14} />
              ) : (
                <FiTrendingDown size={14} />
              )}
              {isPositive ? "+" : ""}
              {lastWeekChange}%
            </div>
          </div>

          {/* Total */}
          <p
            className="mb-0 mt-2"
            style={{
              fontSize: "28px",
              fontWeight: 600,
              color: isDark ? "#fff" : "var(--ds-text-primary, #343330)",
            }}
          >
            ${totalGiving.toLocaleString()}
          </p>
          <span
            style={{ fontSize: "12px", color: "var(--ds-text-muted, #94a3b8)" }}
          >
            Total over 4 weeks
          </span>

          <div style={{ marginTop: "12px", height: "160px" }}>
            <ReactApexChart
              key={isDark ? "dark" : "light"}
              options={chartOptions}
              series={series}
              type="area"
              height={160}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GivingTrendChart;
