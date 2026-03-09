"use client";
import React from "react";
import {
  FiMoreVertical,
  FiCheckCircle,
  FiCalendar,
  FiMessageSquare,
  FiUsers,
  FiDollarSign,
} from "react-icons/fi";

interface Activity {
  id: string;
  type: 'contact' | 'donation' | 'task' | 'appointment' | 'prayer';
  title: string;
  detail: string;
  date: Date;
  icon: string;
  color: string;
}

interface TransactionHistoryCardProps {
  activities?: Activity[];
}

const ActivityCard = ({ activities = [] }: TransactionHistoryCardProps) => {
  // Default items if no activities provided - church language
  const defaultItems = [
    { id: "1", title: "New visitor registered", detail: "David Kim", date: new Date(Date.now() - 86400000), icon: FiUsers, color: "#6366f1" },
    { id: "2", title: "Task completed", detail: "Weekly sermon notes", date: new Date(Date.now() - 2 * 86400000), icon: FiCheckCircle, color: "#059669" },
    { id: "3", title: "Pastoral visit scheduled", detail: "Member care visit", date: new Date(Date.now() - 3 * 86400000), icon: FiCalendar, color: "#d97706" },
    { id: "4", title: "Prayer request received", detail: "Sunday morning prayer", date: new Date(Date.now() - 4 * 86400000), icon: FiMessageSquare, color: "#4f46e5" },
  ];

  // Map activities to display format
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'users': return FiUsers;
      case 'check-circle': return FiCheckCircle;
      case 'dollar-sign': return FiDollarSign;
      case 'calendar': return FiCalendar;
      case 'message-square': return FiMessageSquare;
      default: return FiUsers;
    }
  };

  const items = activities.length > 0 
    ? activities.map(a => ({
        id: a.id,
        title: a.title,
        detail: a.detail,
        date: new Date(a.date),
        icon: getIcon(a.icon),
        color: a.color,
      }))
    : defaultItems;

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

export default ActivityCard;
