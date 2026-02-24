"use client";
import React from "react";
import {
  FiMoreVertical,
  FiCheckCircle,
  FiCalendar,
  FiMessageSquare,
  FiUsers,
} from "react-icons/fi";

const TransactionHistoryCard = () => {
  // MVP placeholder — will be wired to real activity data
  const items = [
    { id: "1", title: "New member joined", detail: "David Kim", date: new Date(Date.now() - 86400000), icon: FiUsers, color: "#6366f1" },
    { id: "2", title: "Task completed", detail: "Weekly newsletter sent", date: new Date(Date.now() - 2 * 86400000), icon: FiCheckCircle, color: "#059669" },
    { id: "3", title: "Appointment confirmed", detail: "Membership Interview", date: new Date(Date.now() - 3 * 86400000), icon: FiCalendar, color: "#d97706" },
    { id: "4", title: "Conversation resolved", detail: "Volunteer training", date: new Date(Date.now() - 4 * 86400000), icon: FiMessageSquare, color: "#4f46e5" },
  ];

  return (
    <div className="w-full h-full">
      <div
        className="bg-card w-full h-full"
        style={{
          borderRadius: "24px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          minHeight: "333px",
        }}
      >
        <div className="p-0">
          <div className="flex items-center justify-between p-6 pb-3">
            <p className="mb-0" style={{ fontSize: "20px", fontWeight: 600, color: "var(--foreground)", lineHeight: "28px", textTransform: "capitalize" }}>
              Recent Activity
            </p>
            <button
              style={{
                width: "40px", height: "40px", borderRadius: "360px",
                background: "var(--muted)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <FiMoreVertical size={20} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>

          <div className="flex flex-col gap-3 px-6 pb-6">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: "32px", height: "32px", borderRadius: "8px",
                        background: `${item.color}15`, display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <Icon size={16} color={item.color} />
                    </div>
                    <div>
                      <p className="mb-0" style={{ fontSize: "13px", fontWeight: 500, color: "var(--foreground)" }}>
                        {item.title}
                      </p>
                      <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                        {item.detail}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                    {item.date.toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryCard;
