"use client";
import React from "react";
import {
  FiMoreVertical,
  FiCalendar,
  FiMessageSquare,
  FiCheckCircle,
  FiUsers,
} from "react-icons/fi";

const RecentActivityCard = () => {
  // Placeholder — will be wired to real data once activity tracking is built
  const activities = [
    { id: "1", title: "New visitor added", detail: "Jennifer Martinez", icon: FiUsers, color: "#6366f1", bg: "#e0e7ff" },
    { id: "2", title: "Task completed", detail: "Send weekly newsletter", icon: FiCheckCircle, color: "#059669", bg: "#d1fae5" },
    { id: "3", title: "Appointment scheduled", detail: "Membership Interview — Michael Davis", icon: FiCalendar, color: "#d97706", bg: "#fef3c7" },
    { id: "4", title: "Conversation resolved", detail: "Thank you call — Sarah Johnson", icon: FiMessageSquare, color: "#4f46e5", bg: "#e0e7ff" },
  ];

  return (
    <div className="w-full h-full">
      <div
        className="bg-card w-full h-full"
        style={{
          borderRadius: "24px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          minHeight: "334px",
        }}
      >
        <div className="p-0">
          <div className="flex items-center justify-between p-6 pb-3">
            <div>
              <p className="mb-0" style={{ fontSize: "20px", fontWeight: 600, color: "var(--foreground)" }}>
                Recent Activity
              </p>
              <p className="mb-0" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                Latest updates across your church
              </p>
            </div>
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

          <div className="flex flex-col px-6 pb-6">
            {activities.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 py-3"
                  style={{
                    borderBottom: index < activities.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: activity.bg, display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <Icon size={18} color={activity.color} />
                  </div>

                  <div className="flex-grow">
                    <p className="mb-0" style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>
                      {activity.title}
                    </p>
                    <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                      {activity.detail}
                    </span>
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
