"use client";
import React from "react";
import Link from "next/link";
import { FiArrowRight, FiUsers } from "react-icons/fi";

interface PipelineData {
  total: number;
  stages: { name: string; count: number }[];
}

const VisitorFollowupsCard = ({ data }: { data?: PipelineData }) => {
  const d = data ?? { total: 0, stages: [] };
  const stagesPreview = d.stages.slice(0, 3);
  const needsAttention = stagesPreview.length > 0 ? stagesPreview[0].count : 0;

  return (
    <div className="w-full h-full">
      <div
        className="card h-full"
        style={{
          borderRadius: "24px",
          overflow: "hidden",
          background: "#343330",
          minHeight: "180px",
        }}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(187, 255, 0, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FiUsers size={20} color="#bbff00" />
            </div>
            {needsAttention > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "360px",
                  background: "#bbff00",
                  color: "#343330",
                }}
              >
                {needsAttention} new visitors
              </span>
            )}
          </div>

          <h3
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#fff",
              marginBottom: "8px",
            }}
          >
            Visitor Follow-ups
          </h3>
          <p style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "12px" }}>
            Linked to Engage Pipeline
          </p>

          <div className="flex gap-4 mb-3">
            <div>
              <p className="mb-0" style={{ fontSize: "24px", fontWeight: 700, color: "#bbff00" }}>
                {d.total}
              </p>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>In Pipeline</span>
            </div>
            <div>
              <p className="mb-0" style={{ fontSize: "24px", fontWeight: 700, color: "#fff" }}>
                {d.stages.length}
              </p>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>Stages</span>
            </div>
          </div>

          {/* Mini Pipeline Preview */}
          <div className="flex gap-2 mb-3">
            {stagesPreview.map((stage, i) => (
              <div key={i} className="text-center" style={{ flex: 1 }}>
                <div
                  style={{
                    height: "4px",
                    background: i === 0 ? "#bbff00" : "#5c5c58",
                    borderRadius: "2px",
                    marginBottom: "4px",
                  }}
                />
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                  {stage.count}
                </span>
              </div>
            ))}
          </div>

          <Link
            href="/app/pipeline"
            className="flex items-center gap-1 mt-auto"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#bbff00",
              textDecoration: "none",
            }}
          >
            Open Pipeline <FiArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VisitorFollowupsCard;
