"use client";
import React from "react";
import {
  FiMoreVertical,
  FiMail,
  FiMessageSquare,
  FiPhone,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";

interface Broadcast {
  id: string;
  title: string;
  channel: string;
  status: string;
  sentAt: Date | string | null;
  totalRecipients: number | null;
}

const RecentBroadcastsCard = ({ broadcasts }: { broadcasts?: Broadcast[] }) => {
  const items = broadcasts ?? [];

  const TypeIcon = ({ type }: { type: string }) => {
    const icons: any = {
      sms: FiMessageSquare,
      email: FiMail,
      call: FiPhone,
    };
    const Icon = icons[type] || FiMessageSquare;
    return <Icon size={14} />;
  };

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
                Recent Broadcasts
              </p>
              <p className="mb-0" style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                Mass communications sent
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

          <div className="flex flex-col gap-3 px-6 pb-6">
            {items.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)", textAlign: "center", padding: "20px 0" }}>
                No broadcasts yet
              </p>
            ) : items.map((broadcast) => (
              <div
                key={broadcast.id}
                className="flex items-center justify-between p-3"
                style={{ background: "var(--muted)", borderRadius: "12px" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: "36px", height: "36px", borderRadius: "8px",
                      background: broadcast.channel === "sms" ? "#bbff00" : broadcast.channel === "email" ? "#818cf8" : "#22c55e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: broadcast.channel === "sms" ? "#343330" : "#fff",
                    }}
                  >
                    <TypeIcon type={broadcast.channel} />
                  </div>
                  <div>
                    <p className="mb-0" style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)" }}>
                      {broadcast.title}
                    </p>
                    <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                      {broadcast.sentAt ? new Date(broadcast.sentAt).toLocaleDateString() : "Draft"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {broadcast.status === "sent" ? (
                    <>
                      <div className="flex items-center gap-1 justify-end" style={{ color: "#16a34a", fontSize: "12px" }}>
                        <FiCheckCircle size={12} />
                        <span>{broadcast.totalRecipients ?? 0}</span>
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
                        delivered
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 justify-end" style={{ color: "#f59e0b", fontSize: "12px" }}>
                      <FiClock size={12} />
                      <span>{broadcast.status}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentBroadcastsCard;
