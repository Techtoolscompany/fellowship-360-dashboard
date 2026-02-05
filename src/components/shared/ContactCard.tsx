"use client";
import React from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MoreVertical,
  MessageSquare,
  Calendar,
} from "lucide-react";

interface ContactCardProps {
  id?: string | number;
  name: string;
  email?: string;
  phone?: string;
  status?: string;
  avatar?: string;
  groups?: string[];
  lastActivity?: string;
  onClick?: () => void;
  compact?: boolean;
}

const ContactCard = ({
  id,
  name,
  email,
  phone,
  status = "Member",
  avatar,
  groups = [],
  lastActivity,
  onClick,
  compact = false,
}: ContactCardProps) => {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "member":
        return { bg: "rgba(34, 197, 94, 0.1)", color: "#22c55e" };
      case "visitor":
        return { bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" };
      case "regular attendee":
        return { bg: "rgba(200, 245, 66, 0.15)", color: "#171717" };
      case "leader":
        return { bg: "rgba(168, 85, 247, 0.1)", color: "#a855f7" };
      default:
        return { bg: "rgba(115, 115, 115, 0.1)", color: "#737373" };
    }
  };

  const statusStyle = getStatusStyle(status);

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl transition-all duration-200"
        style={{
          cursor: onClick ? "pointer" : "default",
        }}
      >
        <div
          className="flex items-center justify-center shrink-0 w-10 h-10 rounded-full font-semibold text-sm text-[#171717] bg-[#bbff00]"
        >
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground mb-0.5">
            {name}
          </div>
          <div className="text-xs text-muted-foreground truncate">{email}</div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{
            background: statusStyle.bg,
            color: statusStyle.color,
          }}
        >
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-full font-semibold text-lg text-[#171717] bg-[#bbff00]"
          >
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="w-full h-full object-cover rounded-[14px]"
              />
            ) : (
              initials
            )}
          </div>
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-transparent text-muted-foreground hover:text-foreground transition-colors">
            <MoreVertical size={16} />
          </button>
        </div>

        <div className="mb-3">
          <h4 className="text-base font-semibold text-foreground mb-1">
            {name}
          </h4>
          <span
            className="px-2.5 py-1 rounded-full text-[11px] font-medium inline-block"
            style={{
              background: statusStyle.bg,
              color: statusStyle.color,
            }}
          >
            {status}
          </span>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <Mail size={14} className="text-muted-foreground/70" />
            <span className="truncate">{email}</span>
          </div>
          {phone && (
            <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <Phone size={14} className="text-muted-foreground/70" />
              <span>{phone}</span>
            </div>
          )}
        </div>

        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {groups.slice(0, 2).map((group, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-secondary text-secondary-foreground"
              >
                {group}
              </span>
            ))}
            {groups.length > 2 && (
              <span className="text-[11px] text-muted-foreground py-1">
                +{groups.length - 2} more
              </span>
            )}
          </div>
        )}

        {lastActivity && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar size={12} />
            Last activity: {lastActivity}
          </div>
        )}
      </div>

      <div className="flex border-t border-border bg-muted/30">
        <Link
          href={`/people/contacts/${id || 1}`}
          className="flex-1 p-3 flex items-center justify-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r border-border"
        >
          View Profile
        </Link>
        <button className="flex-1 p-3 flex items-center justify-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors bg-transparent border-none cursor-pointer">
          <MessageSquare size={14} />
          Message
        </button>
      </div>
    </div>
  );
};

export default ContactCard;
