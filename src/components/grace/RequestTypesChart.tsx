"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface PrayerData { total: number; pending: number; inProgress: number; answered: number; urgent: number; }
interface AppointmentData { total: number; pending: number; confirmed: number; completed: number; }
interface ConversationData { total: number; open: number; waiting: number; resolved: number; }
interface PipelineData { total: number; stages: { name: string; count: number }[]; }

const RequestTypesChart = ({
  prayer,
  appointments,
  conversations,
  pipeline,
}: {
  prayer?: PrayerData;
  appointments?: AppointmentData;
  conversations?: ConversationData;
  pipeline?: PipelineData;
}) => {
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

  const prayerColor = "#bbff00";
  const appointmentColor = "#818cf8";
  const inquiryColor = "#22c55e";
  const visitorColor = isDark ? "#94a3b8" : "#343330";
  const labelColor = isDark ? "#94a3b8" : "#6b7280";

  const totals = {
    prayer: prayer?.total ?? 0,
    appointments: appointments?.total ?? 0,
    inquiries: conversations?.total ?? 0,
    visitors: pipeline?.total ?? 0,
  };

  const chartOptions: any = {
    chart: { type: "donut", fontFamily: "Plus Jakarta Sans, sans-serif", background: "transparent" },
    colors: [prayerColor, appointmentColor, inquiryColor, visitorColor],
    labels: ["Prayer Requests", "Appointments", "Conversations", "Pipeline"],
    legend: { show: true, position: "bottom", horizontalAlign: "left", fontSize: "11px", markers: { width: 8, height: 8, radius: 2 }, itemMargin: { horizontal: 12 }, labels: { colors: labelColor } },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: "60%" } } },
    stroke: { show: false },
  };

  const series = [totals.prayer, totals.appointments, totals.inquiries, totals.visitors];

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
                Request Types
              </p>
              <p className="mb-0" style={{ fontSize: "12px", color: "var(--ds-text-secondary, #737373)" }}>
                Distribution by category
              </p>
            </div>
          </div>

          <div className="flex gap-3 mb-2 flex-wrap">
            <div>
              <span style={{ fontSize: "18px", fontWeight: 600, color: prayerColor }}>{totals.prayer}</span>
              <span style={{ fontSize: "10px", color: "var(--ds-text-muted, #a3a3a3)", marginLeft: "4px" }}>prayer</span>
            </div>
            <div>
              <span style={{ fontSize: "18px", fontWeight: 600, color: appointmentColor }}>{totals.appointments}</span>
              <span style={{ fontSize: "10px", color: "var(--ds-text-muted, #a3a3a3)", marginLeft: "4px" }}>appts</span>
            </div>
            <div>
              <span style={{ fontSize: "18px", fontWeight: 600, color: inquiryColor }}>{totals.inquiries}</span>
              <span style={{ fontSize: "10px", color: "var(--ds-text-muted, #a3a3a3)", marginLeft: "4px" }}>convos</span>
            </div>
            <div>
              <span style={{ fontSize: "18px", fontWeight: 600, color: visitorColor }}>{totals.visitors}</span>
              <span style={{ fontSize: "10px", color: "var(--ds-text-muted, #a3a3a3)", marginLeft: "4px" }}>pipeline</span>
            </div>
          </div>

          <div style={{ height: "200px" }}>
            <ReactApexChart key={isDark ? "dark" : "light"} options={chartOptions} series={series} type="donut" height={200} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestTypesChart;
