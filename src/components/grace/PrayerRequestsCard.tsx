"use client";
import React from "react";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

const PrayerRequestsCard = () => {
  const data = {
    new: 5,
    inProgress: 3,
    resolvedThisWeek: 12,
    urgent: 2,
  };

  return (
    <div className="w-full h-full">
      <div
        className="card h-full"
        style={{
          borderRadius: "24px",
          overflow: "hidden",
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          minHeight: "180px",
        }}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "28px" }}>🙏</span>
            {data.urgent > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "360px",
                  background: "#dc2626",
                  color: "#fff",
                }}
              >
                {data.urgent} urgent
              </span>
            )}
          </div>

          <h3
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#78350f",
              marginBottom: "12px",
            }}
          >
            Prayer Requests
          </h3>

          <div className="flex gap-4 mb-3">
            <div>
              <p
                className="mb-0"
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#78350f",
                }}
              >
                {data.new}
              </p>
              <span style={{ fontSize: "11px", color: "#92400e" }}>New</span>
            </div>
            <div>
              <p
                className="mb-0"
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#78350f",
                }}
              >
                {data.inProgress}
              </p>
              <span style={{ fontSize: "11px", color: "#92400e" }}>
                In Progress
              </span>
            </div>
            <div>
              <p
                className="mb-0"
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#78350f",
                }}
              >
                {data.resolvedThisWeek}
              </p>
              <span style={{ fontSize: "11px", color: "#92400e" }}>
                Resolved
              </span>
            </div>
          </div>

          <Link
            href="/care/prayer-requests"
            className="flex items-center gap-1 mt-auto"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#78350f",
              textDecoration: "none",
            }}
          >
            View All <FiArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrayerRequestsCard;
