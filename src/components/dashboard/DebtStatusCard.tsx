"use client";
import React from "react";
import { FiTrendingUp, FiCalendar } from "react-icons/fi";

const DebtStatusCard = () => {
  // Sample YTD data
  const ytdData = {
    currentAmount: 42580,
    goalAmount: 120000,
    lastYearSameTime: 38200,
    percentComplete: 35.5,
    monthlyBreakdown: [
      { month: "Jan", amount: 22450 },
      { month: "Feb", amount: 20130 },
    ],
  };

  const vsLastYear = (
    ((ytdData.currentAmount - ytdData.lastYearSameTime) /
      ytdData.lastYearSameTime) *
    100
  ).toFixed(1);

  return (
    <div
      className="h-full"
      style={{
        borderRadius: "24px",
        border: "1px solid var(--ds-border-secondary, #b5b5b5)",
        background: "#343330",
        overflow: "hidden",
      }}
    >
      <div className="p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p
              className="mb-1"
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#fff",
              }}
            >
              Giving Year to Date
            </p>
            <div className="flex items-center gap-2">
              <FiCalendar size={14} color="#9ca3af" />
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                Jan 1 - Feb 4, 2025
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-1"
            style={{
              padding: "4px 10px",
              background: "rgba(187, 255, 0, 0.2)",
              borderRadius: "360px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#bbff00",
            }}
          >
            <FiTrendingUp size={12} />+{vsLastYear}% vs last year
          </div>
        </div>

        {/* Main Amount */}
        <div className="mb-4">
          <p
            className="mb-0"
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#fff",
            }}
          >
            ${ytdData.currentAmount.toLocaleString()}
          </p>
          <span style={{ fontSize: "14px", color: "#9ca3af" }}>
            of ${ytdData.goalAmount.toLocaleString()} annual goal
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div
            className="flex items-baseline"
            style={{ paddingRight: "20px" }}
          >
            <div
              style={{
                height: "24px",
                width: `${ytdData.percentComplete}%`,
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
              {ytdData.percentComplete}% Complete
            </span>
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>
              ${(ytdData.goalAmount - ytdData.currentAmount).toLocaleString()}{" "}
              remaining
            </span>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="mt-auto">
          <p
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#9ca3af",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Monthly Breakdown
          </p>
          <div className="flex flex-col gap-2">
            {ytdData.monthlyBreakdown.map((month, index) => (
              <div
                key={index}
                className="flex justify-between items-center"
              >
                <span style={{ fontSize: "14px", color: "#fff" }}>
                  {month.month} 2025
                </span>
                <span
                  style={{ fontSize: "14px", fontWeight: 600, color: "#bbff00" }}
                >
                  ${month.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* View Details Button */}
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

export default DebtStatusCard;
