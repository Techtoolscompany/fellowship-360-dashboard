"use client";
import React from "react";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

interface AppointmentData {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
}

const AppointmentsCard = ({ data }: { data?: AppointmentData }) => {
  const d = data ?? { total: 0, pending: 0, confirmed: 0, completed: 0 };

  return (
    <div className="w-full h-full">
      <div
        className="card h-full"
        style={{
          borderRadius: "24px",
          overflow: "hidden",
          background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
          minHeight: "180px",
        }}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "28px" }}>📅</span>
            {d.pending > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "360px",
                  background: "#f59e0b",
                  color: "#fff",
                }}
              >
                {d.pending} pending
              </span>
            )}
          </div>

          <h3
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#3730a3",
              marginBottom: "12px",
            }}
          >
            Appointments
          </h3>

          <div className="flex gap-4 mb-3">
            <div>
              <p className="mb-0" style={{ fontSize: "24px", fontWeight: 700, color: "#3730a3" }}>
                {d.total}
              </p>
              <span style={{ fontSize: "11px", color: "#4338ca" }}>Total</span>
            </div>
            <div>
              <p className="mb-0" style={{ fontSize: "24px", fontWeight: 700, color: "#3730a3" }}>
                {d.confirmed}
              </p>
              <span style={{ fontSize: "11px", color: "#4338ca" }}>Confirmed</span>
            </div>
            <div>
              <p className="mb-0" style={{ fontSize: "24px", fontWeight: 700, color: "#3730a3" }}>
                {d.completed}
              </p>
              <span style={{ fontSize: "11px", color: "#4338ca" }}>Completed</span>
            </div>
          </div>

          <Link
            href="/app/appointments"
            className="flex items-center gap-1 mt-auto"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#3730a3",
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

export default AppointmentsCard;
