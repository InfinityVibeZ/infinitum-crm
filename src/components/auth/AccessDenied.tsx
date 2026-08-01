"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { IconShieldLock, IconArrowLeft } from "@tabler/icons-react";

export function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-5 shadow-xl shadow-rose-500/5">
        <IconShieldLock size={36} />
      </div>

      <h1 className="text-2xl font-black text-white tracking-wider uppercase mb-2">
        Access Denied
      </h1>

      <p className="text-sm text-nexus-muted max-w-sm leading-relaxed mb-6">
        You don't have permission to access this page. Please contact your administrator if you believe this is an error.
      </p>

      <button
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-nexus-primary text-black rounded-xl hover:bg-nexus-primary/90 transition-all shadow-lg shadow-nexus-primary/20"
      >
        <IconArrowLeft size={18} />
        <span>Go to Dashboard</span>
      </button>
    </div>
  );
}
