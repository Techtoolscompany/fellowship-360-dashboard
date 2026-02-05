"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FiChevronDown } from "react-icons/fi";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

const CallActivityChart = () => {
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

  const outboundColor = "#bbff00";
  const inboundColor = isDark ? "#94a3b8" : "#343330";
  const labelColor = isDark ? "#94a3b8" : "#6b7280";

  const chartOptions: any = {
    chart: {
      type: "bar",
      fontFamily: "Plus Jakarta Sans, sans-serif",
      toolbar: { show: false },
      stacked: false,
      background: "transparent",
    },
    colors: [outboundColor, inboundColor],
    plotOptions: {
      bar: {
        borderRadius: 6,
        borderRadiusApplication: "end",
        columnWidth: "55%",
      },
    },
    dataLabels: { enabled: false },
    legend: {
      show: true,
      position: "bottom",
      horizontalAlign: "left",
      fontSize: "12px",
      markers: { width: 8, height: 8, radius: 2 },
      itemMargin: { horizontal: 16 },
      labels: { colors: labelColor },
    },
    grid: {
      show: true,
      borderColor: isDark ? "#334155" : "#e5e7eb",
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
    },
    xaxis: {
      categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { fontSize: "12px", colors: labelColor },
      },
    },
    yaxis: {
      show: true,
      labels: {
        style: { fontSize: "11px", colors: labelColor },
      },
    },
    tooltip: { enabled: true, shared: true, intersect: false },
  };

  const series = [
    { name: "Outbound", data: [18, 24, 22, 28, 24, 8, 4] },
    { name: "Inbound", data: [8, 12, 10, 14, 12, 6, 2] },
  ];

  const totalOutbound = series[0].data.reduce((a, b) => a + b, 0);
  const totalInbound = series[1].data.reduce((a, b) => a + b, 0);

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
          <div className="flex items-start justify-between mb-2">
            <div>
              <p
                className="mb-1"
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--ds-text-primary, #171717)",
                }}
              >
                Call Activity
              </p>
              <p
                className="mb-0"
                style={{
                  fontSize: "12px",
                  color: "var(--ds-text-secondary, #737373)",
                }}
              >
                Outbound vs Inbound calls
              </p>
            </div>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 12px",
                background: "#bbff00",
                borderRadius: "360px",
                border: "none",
                fontSize: "14px",
                color: "#000329",
                cursor: "pointer",
              }}
            >
              Week <FiChevronDown size={16} />
            </button>
          </div>

          <div className="flex gap-4 mb-2">
            <div>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#bbff00",
                }}
              >
                {totalOutbound}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--ds-text-muted, #a3a3a3)",
                  marginLeft: "4px",
                }}
              >
                outbound
              </span>
            </div>
            <div>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--ds-text-primary, #171717)",
                }}
              >
                {totalInbound}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--ds-text-muted, #a3a3a3)",
                  marginLeft: "4px",
                }}
              >
                inbound
              </span>
            </div>
          </div>

          <div style={{ height: "190px" }}>
            <ReactApexChart
              key={isDark ? "dark" : "light"}
              options={chartOptions}
              series={series}
              type="bar"
              height={190}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallActivityChart;
