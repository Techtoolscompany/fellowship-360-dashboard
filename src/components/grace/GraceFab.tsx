"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { ChatDrawer } from "./ChatDrawer";

export function GraceFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-[#bbff00] to-[#8fcc00] text-[#1a1d21] shadow-lg shadow-[#bbff00]/25 hover:shadow-xl hover:shadow-[#bbff00]/40 hover:scale-110 transition-all duration-200 flex items-center justify-center group"
        aria-label="Open Grace AI Chat"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-[#bbff00]/30 animate-ping opacity-50" />
      </button>

      {/* Chat Drawer */}
      <ChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
