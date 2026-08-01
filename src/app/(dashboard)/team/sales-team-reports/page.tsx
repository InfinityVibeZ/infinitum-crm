"use client";

import { useState, useEffect } from "react";
import { IconChartBar, IconUsers, IconTrendingUp, IconTrophy, IconUserCheck, IconTarget } from "@tabler/icons-react";
import Link from "next/link";

export default function SalesTeamReportsMainPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((res) => res.json()),
      fetch("/api/deals").then((res) => res.json()),
    ])
      .then(([uData, dData]) => {
        if (Array.isArray(uData)) setUsers(uData);
        if (Array.isArray(dData)) setDeals(dData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = deals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconChartBar size={24} />
            </span>
            Sales Team Reports & Performance
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-1">
            Complete executive dashboard for sales performance, pipeline forecasting, rep cards, and team rankings.
          </p>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2">
          <Link
            href="/team/sales-team-reports/rep-cards"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg transition-colors text-[#38BDF8]"
          >
            <IconUserCheck size={16} />
            <span>Rep Performance Cards</span>
          </Link>

          <Link
            href="/team/sales-team-reports/forecast"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg transition-colors text-[#10D078]"
          >
            <IconTarget size={16} />
            <span>Pipeline Forecast</span>
          </Link>

          <Link
            href="/team/sales-team-reports/leaderboard"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg transition-colors text-amber-400"
          >
            <IconTrophy size={16} />
            <span>Rep Leaderboard</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary font-semibold uppercase">Total Sales Reps</span>
          <div className="text-2xl font-bold mt-1 text-white">{loading ? "..." : users.length}</div>
          <span className="text-[11px] text-[#10D078] mt-1 block">Active sales team</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary font-semibold uppercase">Total Deals Closed</span>
          <div className="text-2xl font-bold mt-1 text-[#10D078]">{loading ? "..." : deals.length}</div>
          <span className="text-[11px] text-nexus-muted mt-1 block">Contract signed & won</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary font-semibold uppercase">Closed Revenue</span>
          <div className="text-2xl font-bold mt-1 text-white">₹{totalRevenue.toLocaleString()}</div>
          <span className="text-[11px] text-[#10D078] mt-1 block">↑ 18.4% growth</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary font-semibold uppercase">Avg Win Rate</span>
          <div className="text-2xl font-bold mt-1 text-[#F59E0B]">25.0%</div>
          <span className="text-[11px] text-amber-400 mt-1 block">Team average</span>
        </div>
      </div>
    </div>
  );
}
