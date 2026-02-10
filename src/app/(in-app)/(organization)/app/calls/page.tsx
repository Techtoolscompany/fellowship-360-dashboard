"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  Search,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import useOrganization from "@/lib/organizations/useOrganization";
import { getPhoneCalls } from "@/app/actions/communications";

type PhoneCallRow = Awaited<ReturnType<typeof getPhoneCalls>>[number];

export default function CallsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [calls, setCalls] = useState<PhoneCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getPhoneCalls(orgId);
      setCalls(data);
    } catch (err) {
      console.error("Failed to fetch calls:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const normalizedCalls = useMemo(() => {
    return calls.map((row) => {
      const contactName = row.contact
        ? `${row.contact.firstName} ${row.contact.lastName}`
        : row.conversation.subject || "Unknown Contact";
      const type = row.latestDirection ?? "outbound";
      const status =
        row.conversation.status === "resolved"
          ? "completed"
          : row.conversation.status === "waiting"
          ? "missed"
          : "active";

      return {
        id: row.conversation.id,
        contactName,
        phone: row.contact?.phone || "N/A",
        type,
        status,
        date: row.latestSentAt || row.conversation.lastMessageAt || row.conversation.createdAt,
        notes: row.latestContent || row.conversation.subject || "No notes",
      };
    });
  }, [calls]);

  const filteredCalls = normalizedCalls.filter((call) => {
    const matchesSearch = call.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.phone.includes(searchQuery);
    if (filterType === "all") return matchesSearch;
    if (filterType === "missed") return matchesSearch && call.status === "missed";
    return matchesSearch && call.type === filterType;
  });

  const stats = useMemo(() => {
    const inbound = normalizedCalls.filter((c) => c.type === "inbound").length;
    const outbound = normalizedCalls.filter((c) => c.type === "outbound").length;
    const missed = normalizedCalls.filter((c) => c.status === "missed").length;
    return [
      { label: "Total Calls", value: String(normalizedCalls.length), icon: Phone, color: "text-[#bbff00]" },
      { label: "Inbound", value: String(inbound), icon: PhoneIncoming, color: "text-green-400" },
      { label: "Outbound", value: String(outbound), icon: PhoneOutgoing, color: "text-blue-400" },
      { label: "Missed", value: String(missed), icon: PhoneMissed, color: "text-red-400" },
    ];
  }, [normalizedCalls]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "inbound": return <PhoneIncoming size={14} className="text-green-400" />;
      case "outbound": return <PhoneOutgoing size={14} className="text-blue-400" />;
      case "missed": return <PhoneMissed size={14} className="text-red-400" />;
      default: return <Phone size={14} className="text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400",
      missed: "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
      voicemail: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    };
    return styles[status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Call Log</h2>
          <nav aria-label="breadcrumb" className="text-sm text-muted-foreground mt-1">
            <ol className="flex items-center gap-1">
              <li><Link href="/app/home" className="hover:text-primary">Home</Link></li>
              <li>/</li>
              <li>Communication</li>
              <li>/</li>
              <li className="text-foreground font-medium" aria-current="page">Calls</li>
            </ol>
          </nav>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search calls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {["all", "inbound", "outbound", "missed"].map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
              className={filterType === type ? "bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]" : ""}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Call Log Table */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Contact</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Channel</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      No phone conversations found.
                    </td>
                  </tr>
                ) : filteredCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs text-[#171717]"
                          style={{ background: "linear-gradient(135deg, #c8f542 0%, #a8d435 100%)" }}
                        >
                          {call.contactName.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{call.contactName}</p>
                          <p className="text-xs text-muted-foreground">{call.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(call.type)}
                        <span className="capitalize text-muted-foreground">{call.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${getStatusBadge(call.status)}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} />
                        Phone
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} />
                        {new Date(call.date).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs max-w-[260px] truncate">
                      {call.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
