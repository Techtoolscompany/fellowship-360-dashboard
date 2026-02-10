"use client";
import React from "react";
import { FiMoreVertical, FiCheck, FiClock } from "react-icons/fi";

interface DonationRow {
  id: string;
  amount: string;
  fund: string;
  method: string;
  date: Date | string;
  donorName: string;
}

const TransactionHistoryCard = ({ donations }: { donations?: DonationRow[] }) => {
  const items = donations ?? [];

  const StatusBadge = ({ status }: { status: string }) => {
    return (
      <div
        className="flex items-center gap-2"
        style={{ padding: "4px 8px", background: "#c5f4d4", borderRadius: "360px" }}
      >
        <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FiCheck size={16} color="#19cf56" />
        </div>
        <span style={{ fontSize: "12px", fontWeight: 400, color: "#19cf56", textTransform: "capitalize" }}>
          Done
        </span>
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <div
        className="bg-card w-full h-full"
        style={{
          borderRadius: "24px",
          overflow: "hidden",
          border: "1px solid var(--ds-border-secondary, #e2e8f0)",
          minHeight: "333px",
        }}
      >
        <div className="p-0">
          <div className="flex items-center justify-between p-6 pb-3">
            <p className="mb-0" style={{ fontSize: "20px", fontWeight: 600, color: "var(--ds-text-primary, #343330)", lineHeight: "28px", textTransform: "capitalize" }}>
              Recent Activity
            </p>
            <button
              style={{
                width: "40px", height: "40px", borderRadius: "360px",
                background: "var(--ds-bg-tertiary, #f3f4f6)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              <FiMoreVertical size={20} style={{ color: "var(--ds-icon-default, #6b7280)" }} />
            </button>
          </div>

          <div
            className="flex items-center justify-between px-6 py-2"
            style={{ fontSize: "12px", fontWeight: 400, color: "var(--ds-text-secondary, #6b7280)", textTransform: "uppercase" }}
          >
            <span style={{ width: "70px" }}>Date & Time</span>
            <span style={{ width: "70px" }}>Amount</span>
            <span style={{ width: "86px", textAlign: "center" }}>Status</span>
          </div>

          <div className="flex flex-col gap-3 px-6 mt-2">
            {items.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--ds-text-muted, #a3a3a3)", textAlign: "center", padding: "20px 0" }}>
                No recent transactions
              </p>
            ) : items.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--ds-text-secondary, #6b7280)", width: "70px", textTransform: "capitalize" }}>
                  {new Date(tx.date).toLocaleDateString()}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--ds-text-primary, #343330)", width: "70px", textTransform: "capitalize" }}>
                  ${Number(tx.amount).toLocaleString()}
                </span>
                <div style={{ width: "86px", display: "flex", justifyContent: "flex-end" }}>
                  <StatusBadge status="done" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryCard;
