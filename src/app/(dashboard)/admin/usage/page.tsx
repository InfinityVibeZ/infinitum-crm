"use client";

import { useState, useEffect } from "react";
import { IconChartBar } from "@tabler/icons-react";

import { SkeletonTable } from "@/components/ui/Skeleton";

export default function AdminUsagePage() {
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/admin/usage", {
          headers: { Authorization: `Bearer ${localStorage.getItem("nexus-token")}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsage(Array.isArray(data?.usage) ? data.usage : []);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 text-nexus-text">
        <div className="animate-pulse">
          <div className="h-8 bg-nexus-border/50 rounded-lg w-48 mb-2"></div>
          <div className="h-4 bg-nexus-border/30 rounded-lg w-80"></div>
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
          <IconChartBar size={24} className="text-amber-400" />
          Feature Usage
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">Platform-wide visibility of tracked metered feature usage.</p>
      </div>

      <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-nexus-hover/50 text-nexus-text-secondary text-xs uppercase tracking-wider border-b border-nexus-border">
                <th className="px-6 py-4 font-semibold">Company</th>
                <th className="px-6 py-4 font-semibold">Feature Code</th>
                <th className="px-6 py-4 font-semibold">Usage</th>
                <th className="px-6 py-4 font-semibold">Limit</th>
                <th className="px-6 py-4 font-semibold">Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nexus-border">
              {usage.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-nexus-muted text-sm">No usage records found.</td></tr>
              ) : (
                usage.map((u) => (
                  <tr key={u.id} className="hover:bg-nexus-hover/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold">{u.company?.name || u.companyId || "Unknown"}</td>
                    <td className="px-6 py-4 text-xs text-nexus-primary">{u.featureCode}</td>
                    <td className="px-6 py-4 font-bold text-nexus-text">{u.usageValue?.toString() || "0"}</td>
                    <td className="px-6 py-4 text-xs text-nexus-muted">{u.limitValue?.toString() || "Unlimited"}</td>
                    <td className="px-6 py-4 text-[10px] text-nexus-muted">
                      {new Date(u.periodStart).toLocaleDateString()} - {new Date(u.periodEnd).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
