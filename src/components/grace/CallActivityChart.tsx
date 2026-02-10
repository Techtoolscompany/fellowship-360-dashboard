"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FiChevronDown } from "react-icons/fi";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface ConversationData { total: number; open: number; waiting: number; resolved: number; }
interface TaskData { total: number; completed: number; pending: number; inProgress: number; }

const CallActivityChart = ({ conversations, tasks }: { conversations?: ConversationData; tasks?: TaskData }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDark(
        document.documentElement.classList.contains("dark") ||
        document.documentElement.classList.contains("app-skin-dark")
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const outboundColor = "#bbff00";
  const inboundColor = isDark ? "#94a3b8" : "#343330";
  const labelColor = isDark ? "#94a3b8" : "#6b7280";

  // Use real data for a summary view
  const convTotal = conversations?.total ?? 0;
  const taskTotal = tasks?.total ?? 0;

  const chartOptions: any = {
    chart: { type: "bar", fontFamily: "Plus Jakarta Sans, sans-serif", toolbar: { show: false }, stacked: false, background: "transparent" },
    colors: [outboundColor, inboundColor],
    plotOptions: { bar: { borderRadius: 6, borderRadiusApplication: "end", columnWidth: "55%" } },
    dataLabels: { enabled: false },
    legend: { show: true, position: "bottom", horizontalAlign: "left", fontSize: "12px", markers: { width: 8, height: 8, radius: 2 }, itemMargin: { horizontal: 16 }, labels: { colors: labelColor } },
    grid: { show: true, borderColor: isDark ? "#334155" : "#e5e7eb", strokeDashArray: 4, xaxis: { lines: { show: false } } },
    xaxis: { categories: ["Conversations", "Tasks"], axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { fontSize: "12px", colors: labelColor } } },
    yaxis: { show: true, labels: { style: { fontSize: "11px", colors: labelColor } } },
    tooltip: { enabled: true, shared: true, intersect: false },
  };

  const series = [
    { name: "Active", data: [conversations?.open ?? 0, tasks?.inProgress ?? 0] },
    { name: "Resolved", data: [conversations?.resolved ?? 0, tasks?.completed ?? 0] },
  ];

  return (
    <div className="w-full h-full">
      <div
        className="bg-card w-full h-full"
        style={{ borderRadius: "24px", overflow: "hidden", border: "1px solid var(--ds-border-secondary, #e2e8f0)", minHeight: "334px" }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="mb-1" style={{ fontSize: "20px", fontWeight: 600, color: "var(--ds-text-primary, #171717)" }}>
                Activity Overview
              </p>
              <p className="mb-0" style={{ fontSize: "12px", color: "var(--ds-text-secondary, #737373)" }}>
                Conversations & Tasks progress
              </p>
            </div>
          </div>

          <div className="flex gap-4 mb-2">
            <div>
              <span style={{ fontSize: "20px", fontWeight: 600, color: "#bbff00" }}>{convTotal}</span>
              <span style={{ fontSize: "11px", color: "var(--ds-text-muted, #a3a3a3)", marginLeft: "4px" }}>conversations</span>
            </div>
            <div>
              <span style={{ fontSize: "20px", fontWeight: 600, color: "var(--ds-text-primary, #171717)" }}>{taskTotal}</span>
              <span style={{ fontSize: "11px", color: "var(--ds-text-muted, #a3a3a3)", marginLeft: "4px" }}>tasks</span>
            </div>
          </div>

          <div style={{ height: "190px" }}>
            <ReactApexChart key={isDark ? "dark" : "light"} options={chartOptions} series={series} type="bar" height={190} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallActivityChart;
