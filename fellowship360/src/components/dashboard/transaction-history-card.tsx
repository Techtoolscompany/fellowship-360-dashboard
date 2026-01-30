"use client";

import { MoreVertical, Check, Clock } from "lucide-react";

const transactions = [
  { date: "13/1/2024", amount: "$12,432", status: "pending" as const },
  { date: "12/1/2024", amount: "$184", status: "done" as const },
  { date: "10/1/2024", amount: "$235", status: "pending" as const },
];

function StatusBadge({ status }: { status: "done" | "pending" }) {
  if (status === "done") {
    return (
      <div className="flex items-center gap-2 rounded-pill bg-green-100 px-2 py-1">
        <Check className="h-4 w-4 text-green-500" />
        <span className="text-xs capitalize text-green-500">Done</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-pill bg-red-100 px-2 py-1">
      <Clock className="h-4 w-4 text-red-500" />
      <span className="text-xs capitalize text-red-500">Pending</span>
    </div>
  );
}

export function TransactionHistoryCard() {
  return (
    <div className="h-[333px] overflow-hidden rounded-card border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <p className="text-xl font-semibold capitalize text-dark">
          Recent Activity
        </p>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border-none bg-white">
          <MoreVertical className="h-5 w-5 text-dark" />
        </button>
      </div>

      {/* Table Header */}
      <div className="flex items-center justify-between px-4 py-2 text-xs uppercase text-dark/70">
        <span className="w-[70px]">Date & Time</span>
        <span className="w-[70px]">Amount</span>
        <span className="w-[86px] text-center">Status</span>
      </div>

      {/* Rows */}
      <div className="mt-2 flex flex-col gap-3 px-4">
        {transactions.map((tx, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="w-[70px] text-xs capitalize text-dark">
              {tx.date}
            </span>
            <span className="w-[70px] text-xs font-medium capitalize text-dark">
              {tx.amount}
            </span>
            <div className="flex w-[86px] justify-end">
              <StatusBadge status={tx.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
