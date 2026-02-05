"use client";
import React from "react";
import {
  FiPhone,
  FiPhoneIncoming,
  FiPhoneOutgoing,
  FiMessageSquare,
  FiUsers,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";

const GraceKpiStrip = () => {
  const kpis = [
    {
      label: "Calls Today",
      value: "24",
      subtitle: "Outbound calls made",
      icon: FiPhoneOutgoing,
      trend: "+8",
      trendDirection: "up",
      iconBg: "#bbff00",
    },
    {
      label: "Connected",
      value: "18",
      subtitle: "75% connection rate",
      icon: FiPhone,
      trend: "+5%",
      trendDirection: "up",
      iconBg: "#bbff00",
    },
    {
      label: "Inbound Calls",
      value: "12",
      subtitle: "Received today",
      icon: FiPhoneIncoming,
      trend: "+3",
      trendDirection: "up",
      iconBg: "#bbff00",
    },
    {
      label: "Broadcasts Sent",
      value: "3",
      subtitle: "This week",
      icon: FiMessageSquare,
      trend: "0",
      trendDirection: "neutral",
      iconBg: "#bbff00",
    },
    {
      label: "People Reached",
      value: "847",
      subtitle: "Via all channels",
      icon: FiUsers,
      trend: "+124",
      trendDirection: "up",
      iconBg: "#bbff00",
    },
  ];

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div
        className="flex items-stretch min-w-max"
        style={{
          borderTop: "1px solid var(--ds-border-secondary, #e5e5e5)",
          borderBottom: "1px solid var(--ds-border-secondary, #e5e5e5)",
        }}
      >
        {kpis.map((kpi, index) => (
          <React.Fragment key={kpi.label}>
            <div
              className="flex flex-col gap-2 py-4"
              style={{
                flex: "1 1 160px",
                minWidth: "150px",
                paddingRight: "20px",
                paddingLeft: index > 0 ? "20px" : "0",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    background: kpi.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <kpi.icon size={18} color="#343330" />
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--ds-text-secondary, #737373)",
                    lineHeight: 1.4,
                  }}
                >
                  {kpi.label}
                </span>
              </div>

              <div className="flex items-end gap-2">
                <p
                  className="mb-0"
                  style={{
                    fontSize: "28px",
                    fontWeight: 600,
                    color: "var(--ds-text-primary, #171717)",
                    lineHeight: 1.2,
                  }}
                >
                  {kpi.value}
                </p>
                {kpi.trendDirection !== "neutral" && (
                  <span
                    className="flex items-center gap-1 mb-1"
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color:
                        kpi.trendDirection === "up" ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {kpi.trendDirection === "up" ? (
                      <FiTrendingUp size={12} />
                    ) : (
                      <FiTrendingDown size={12} />
                    )}
                    {kpi.trend}
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: "11px",
                  color: "var(--ds-text-muted, #a3a3a3)",
                }}
              >
                {kpi.subtitle}
              </span>
            </div>

            {index < kpis.length - 1 && (
              <div
                style={{
                  width: "1px",
                  background: "var(--ds-border-secondary, #e5e5e5)",
                  alignSelf: "stretch",
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default GraceKpiStrip;
