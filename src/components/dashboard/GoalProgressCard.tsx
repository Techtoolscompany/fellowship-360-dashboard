"use client";
import React from "react";
import { FiTrendingUp, FiCalendar, FiHeart } from "react-icons/fi";

interface PrayerData {
  total: number;
  pending: number;
  inProgress: number;
  answered: number;
  urgent: number;
}

interface DebtStatusCardProps {
  yearlyGiving?: number;
  prayerData?: PrayerData;
}

const GoalProgressCard = ({ yearlyGiving = 0, prayerData }: DebtStatusCardProps) => {
  // Use real data if available, otherwise show placeholders
  const prayerCount = prayerData?.total ?? 0;
  const urgentPrayers = prayerData?.urgent ?? 0;
  const current = prayerCount > 0 ? Math.min((prayerCount / 100) * 100, 100) : 67;
  const target = 100;
  const percentComplete = current.toFixed(1);

  // Church-specific: show yearly giving if available
  const hasGiving = yearlyGiving > 0;
  const displayValue = hasGiving 
    ? `$${yearlyGiving.toLocaleString()}` 
    : `${percentComplete}%`;

  return (
    <div
      className="h-full"
      style={{
        borderRadius: "24px",
        border: "1px solid var(--border)",
        background: "#343330",
        overflow: "hidden",
      }}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="mb-1" style={{ fontSize: "20px", fontWeight: 700, color: "#fff" }}>
              Church Goals
            </p>
            <div className="flex items-center gap-2">
              <FiCalendar size={14} color="#9ca3af" />
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                Jan 1 - {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-0" style={{ fontSize: "36px", fontWeight: 700, color: "#fff" }}>
            {current}%
          </p>
          <span style={{ fontSize: "14px", color: "#9ca3af" }}>
            Prayer requests target: {target}%
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline" style={{ paddingRight: "20px" }}>
            <div
              style={{
                height: "24px",
                width: `${percentComplete}%`,
                borderRadius: "360px",
                background: "#bbff00",
                marginRight: "-20px",
                zIndex: 2,
                position: "relative",
              }}
            />
            <div
              style={{
                height: "24px",
                flex: 1,
                borderRadius: "360px",
                background: "#4b4b47",
                zIndex: 1,
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span style={{ fontSize: "14px", fontWeight: 500, color: "#fff" }}>
              {percentComplete}% Complete
            </span>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>
              {target - current}% remaining
            </span>
          </div>
        </div>

        <button
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "360px",
            background: "#fff",
            border: "none",
            fontSize: "14px",
            fontWeight: 600,
            color: "#343330",
            cursor: "pointer",
            marginTop: "24px",
          }}
        >
          View Full Report
        </button>
      </div>
    </div>
  );
};

export default GoalProgressCard;
