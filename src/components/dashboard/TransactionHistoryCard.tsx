"use client";
import React from "react";
import { FiMoreVertical, FiCheck, FiClock } from "react-icons/fi";

const TransactionHistoryCard = () => {
  const transactions = [
    {
      date: "02/04/2025",
      type: "Tithe",
      donor: "Johnson Family",
      amount: "$850",
      status: "done",
    },
    {
      date: "02/04/2025",
      type: "Offering",
      donor: "Williams, M.",
      amount: "$125",
      status: "done",
    },
    {
      date: "02/03/2025",
      type: "Building Fund",
      donor: "Anonymous",
      amount: "$2,500",
      status: "pending",
    },
    {
      date: "02/02/2025",
      type: "Missions",
      donor: "Chen, D.",
      amount: "$200",
      status: "done",
    },
    {
      date: "02/01/2025",
      type: "Tithe",
      donor: "Garcia Family",
      amount: "$1,100",
      status: "done",
    },
  ];

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === "done") {
      return (
        <div
          className="flex items-center gap-2"
          style={{
            padding: "4px 8px",
            background: "#c5f4d4",
            borderRadius: "360px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FiCheck size={16} color="#19cf56" />
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "#19cf56",
              textTransform: "capitalize",
            }}
          >
            Done
          </span>
        </div>
      );
    }
    return (
      <div
        className="flex items-center gap-2"
        style={{
          padding: "4px 8px",
          background: "#ffdbdb",
          borderRadius: "360px",
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FiClock size={16} color="#fd4a4a" />
        </div>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "#fd4a4a",
            textTransform: "capitalize",
          }}
        >
          Pending
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
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-3">
            <p
              className="mb-0"
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--ds-text-primary, #343330)",
                lineHeight: "28px",
                textTransform: "capitalize",
              }}
            >
              Recent Activity
            </p>
            <button
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "360px",
                background: "var(--ds-bg-tertiary, #f3f4f6)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <FiMoreVertical
                size={20}
                style={{ color: "var(--ds-icon-default, #6b7280)" }}
              />
            </button>
          </div>

          {/* Table Header */}
          <div
            className="flex items-center justify-between px-6 py-2"
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--ds-text-secondary, #6b7280)",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: "70px" }}>Date & Time</span>
            <span style={{ width: "70px" }}>Amount</span>
            <span style={{ width: "86px", textAlign: "center" }}>Status</span>
          </div>

          {/* Table Body */}
          <div className="flex flex-col gap-3 px-6 mt-2">
            {transactions.map((tx, index) => (
              <div
                key={index}
                className="flex items-center justify-between"
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "var(--ds-text-secondary, #6b7280)",
                    width: "70px",
                    textTransform: "capitalize",
                  }}
                >
                  {tx.date}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--ds-text-primary, #343330)",
                    width: "70px",
                    textTransform: "capitalize",
                  }}
                >
                  {tx.amount}
                </span>
                <div
                  style={{
                    width: "86px",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <StatusBadge status={tx.status} />
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
