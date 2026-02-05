"use client";
import React from "react";
import { FiArrowRight } from "react-icons/fi";

const HighlightPromoCard = () => {
  return (
    <div className="w-full">
      <div
        className="bg-card"
        style={{
          borderRadius: "24px",
          border: "1px solid var(--ds-border-secondary, #e9e9e9)",
          background: "var(--ds-bg-highlight, #f4ffd4)",
          overflow: "hidden",
          position: "relative",
          height: "334px",
          cursor: "pointer",
        }}
        onClick={() => window.open("https://fellowship360.com/free", "_blank")}
      >
        <div className="p-6 h-full flex flex-col justify-between">
          {/* Decorative Dots */}
          <div className="flex gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--ds-text-primary, #000)",
                }}
              />
            ))}
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: "28px",
              fontWeight: 600,
              lineHeight: "36px",
              color: "var(--ds-text-primary, #343330)",
              maxWidth: "268px",
              marginBottom: 0,
            }}
          >
            Click here to learn how Fellowship 360 can be free!
          </h2>

          {/* CTA Button */}
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              background: "#343330",
              color: "#fff",
              border: "none",
              borderRadius: "360px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              width: "fit-content",
              marginTop: "16px",
              zIndex: 2,
            }}
          >
            Learn More
            <FiArrowRight size={16} />
          </button>

          {/* Concentric Circles Decoration */}
          <div
            style={{
              position: "absolute",
              right: "-40px",
              bottom: "-60px",
              width: "284px",
              height: "284px",
            }}
          >
            {/* Outer Circle */}
            <div
              style={{
                position: "absolute",
                width: "284px",
                height: "284px",
                borderRadius: "50%",
                border: "2px solid rgba(187, 255, 0, 0.5)",
                background: "transparent",
              }}
            />
            {/* Middle Circle */}
            <div
              style={{
                position: "absolute",
                top: "26px",
                left: "26px",
                width: "232px",
                height: "232px",
                borderRadius: "50%",
                border: "2px solid rgba(187, 255, 0, 0.7)",
                background: "transparent",
              }}
            />
            {/* Inner Circle */}
            <div
              style={{
                position: "absolute",
                top: "52px",
                left: "52px",
                width: "180px",
                height: "180px",
                borderRadius: "50%",
                background: "#bbff00",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HighlightPromoCard;
