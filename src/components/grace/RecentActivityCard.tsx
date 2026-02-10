"use client";
import React from "react";
import {
  FiMoreVertical,
  FiDollarSign,
  FiHeart,
  FiCalendar,
  FiMessageSquare,
  FiUser,
} from "react-icons/fi";

interface DonationRow {
  id: string;
  amount: string;
  fund: string;
  method: string;
  date: Date | string;
  donorName: string;
}

const RecentActivityCard = ({ donations }: { donations?: DonationRow[] }) => {
  const items = donations ?? [];

  const getIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case "stripe": return { icon: FiDollarSign, bg: "#bbff00", color: "#343330" };
      case "check": return { icon: FiDollarSign, bg: "#e0e7ff", color: "#4f46e5" };
      case "cash": return { icon: FiDollarSign, bg: "#d1fae5", color: "#059669" };
      default: return { icon: FiDollarSign, bg: "#fef3c7", color: "#d97706" };
    }
  };

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
        <div className="p-0">
          <div className="flex items-center justify-between p-6 pb-3">
            <div>
              <p className="mb-0" style={{ fontSize: "20px", fontWeight: 600, color: "var(--ds-text-primary, #171717)" }}>
                Recent Activity
              </p>
              <p className="mb-0" style={{ fontSize: "12px", color: "var(--ds-text-secondary, #737373)" }}>
                Latest donations and transactions
              </p>
            </div>
            <button
              style={{
                width: "40px", height: "40px", borderRadius: "360px",
                background: "var(--ds-bg-tertiary, #f5f5f5)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <FiMoreVertical size={20} style={{ color: "var(--ds-icon-default, #6b7280)" }} />
            </button>
          </div>

          <div className="flex flex-col px-6 pb-6">
            {items.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--ds-text-muted, #a3a3a3)", textAlign: "center", padding: "20px 0" }}>
                No recent activity
              </p>
            ) : items.map((activity, index) => {
              const iconConfig = getIcon(activity.method);
              const Icon = iconConfig.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 py-3"
                  style={{
                    borderBottom: index < items.length - 1 ? "1px solid var(--ds-border-secondary, #e5e5e5)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: iconConfig.bg, display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <Icon size={18} color={iconConfig.color} />
                  </div>

                  <div className="flex-grow">
                    <p className="mb-0" style={{ fontSize: "14px", fontWeight: 500, color: "var(--ds-text-primary, #171717)" }}>
                      ${Number(activity.amount).toLocaleString()} — {activity.fund}
                    </p>
                    <span style={{ fontSize: "12px", color: "var(--ds-text-muted, #a3a3a3)" }}>
                      {activity.donorName || "Anonymous"} · {activity.method}
                    </span>
                  </div>

                  <div className="text-right">
                    <span
                      style={{
                        fontSize: "11px", fontWeight: 500, padding: "4px 8px", borderRadius: "360px",
                        background: "#dcfce7", color: "#16a34a",
                      }}
                    >
                      received
                    </span>
                    <p className="mb-0 mt-1" style={{ fontSize: "11px", color: "var(--ds-text-muted, #a3a3a3)" }}>
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentActivityCard;
