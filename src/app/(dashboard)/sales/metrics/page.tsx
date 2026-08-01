"use client";

import { useState, useEffect } from "react";
import {
  IconChartBar,
  IconTrendingUp,
  IconCurrencyRupee,
  IconCheck,
  IconClock,
  IconTarget,
  IconAward,
  IconBriefcase,
} from "@tabler/icons-react";
import { DateRangeFilter, filterByDateRange, DateRangeKey } from "@/components/common/DateRangeFilter";

function formatRupees(val: number) {
  return `₹ ${val.toLocaleString("en-IN")}`;
}

const PIPELINE_STAGES = [
  { id: "NEW_OPPORTUNITY", label: "New Opportunity", color: "text-sky-400" },
  { id: "DISCOVERY_SCHEDULED", label: "Discovery Scheduled", color: "text-sky-300" },
  { id: "DISCOVERY_COMPLETED", label: "Discovery Completed", color: "text-teal-400" },
  { id: "PROPOSAL_PREP", label: "Proposal Prep", color: "text-purple-400" },
  { id: "PROPOSAL_SENT", label: "Proposal Sent", color: "text-indigo-400" },
  { id: "NEGOTIATION", label: "Negotiation", color: "text-amber-400" },
  { id: "CONTRACT_SENT", label: "Contract Sent", color: "text-orange-400" },
  { id: "CONTRACT_SIGNED", label: "Contract Signed", color: "text-emerald-400" },
  { id: "PROJECT_KICKOFF", label: "Project Kickoff", color: "text-emerald-500" },
  { id: "ON_HOLD", label: "On Hold", color: "text-[#10D078]" },
];

export default function SalesMetricsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeKey>("TODAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetch("/api/deals")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDeals(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Filter deals by selected date range
  const filteredDeals = filterByDateRange(deals, "createdAt", dateRange, startDate, endDate);

  // ── Calculated Metrics from Live DB ──
  const totalDealsCount = filteredDeals.length;

  // Pipeline Value (Sum of all active deals)
  const totalPipelineValue = filteredDeals.reduce(
    (sum, d) => sum + (parseFloat(d.value) || 0),
    0
  );

  // Weighted Forecast (value * prob %)
  const weightedForecast = filteredDeals.reduce((sum, d) => {
    const val = parseFloat(d.value) || 0;
    const prob = (d.probability || 50) / 100;
    return sum + val * prob;
  }, 0);

  // Total Won Revenue (CONTRACT_SIGNED, PROJECT_KICKOFF, CLOSED_WON)
  const wonDeals = filteredDeals.filter((d) =>
    ["CONTRACT_SIGNED", "PROJECT_KICKOFF", "CLOSED_WON"].includes(d.stage)
  );
  const totalWonRevenue = wonDeals.reduce(
    (sum, d) => sum + (parseFloat(d.value) || 0),
    0
  );

  // Win Rate
  const winRate = totalDealsCount > 0 ? ((wonDeals.length / totalDealsCount) * 100).toFixed(1) : "0.0";

  // Avg Deal Size
  const avgDealSize = totalDealsCount > 0 ? Math.round(totalPipelineValue / totalDealsCount) : 0;

  // Revenue by Service Type
  const serviceRevenue: Record<string, { count: number; total: number }> = {};
  filteredDeals.forEach((d) => {
    const st = d.serviceType || "Consulting";
    const val = parseFloat(d.value) || 0;
    if (!serviceRevenue[st]) serviceRevenue[st] = { count: 0, total: 0 };
    serviceRevenue[st].count += 1;
    serviceRevenue[st].total += val;
  });

  // Rep Sales Performance
  const repPerformance: Record<string, { name: string; dealsCount: number; totalVal: number; wonVal: number }> = {};
  filteredDeals.forEach((d) => {
    const repName = d.user?.name || "Unassigned";
    const val = parseFloat(d.value) || 0;
    const isWon = ["CONTRACT_SIGNED", "PROJECT_KICKOFF", "CLOSED_WON"].includes(d.stage);

    if (!repPerformance[repName]) {
      repPerformance[repName] = { name: repName, dealsCount: 0, totalVal: 0, wonVal: 0 };
    }
    repPerformance[repName].dealsCount += 1;
    repPerformance[repName].totalVal += val;
    if (isWon) repPerformance[repName].wonVal += val;
  });

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10D078]/10 border border-[#10D078]/20 text-[#10D078] flex items-center justify-center shadow-lg shadow-[#10D078]/5">
            <IconChartBar size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-nexus-text tracking-tight">
              Sales Pipeline Analytics & Velocity Metrics
            </h1>
            <p className="text-xs text-nexus-text-secondary">
              Comprehensive metrics on sales velocity, weighted forecasts, conversion rates, and revenue breakdown.
            </p>
          </div>
        </div>

        <DateRangeFilter
          value={dateRange}
          startDate={startDate}
          endDate={endDate}
          onChange={(val, s, e) => {
            setDateRange(val);
            if (s !== undefined) setStartDate(s);
            if (e !== undefined) setEndDate(e);
          }}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-nexus-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Won Revenue</span>
            <IconCheck size={18} className="text-[#10D078]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#10D078]">
            {loading ? "…" : formatRupees(totalWonRevenue)}
          </div>
          <p className="text-xs text-[#10D078] font-semibold">
            {wonDeals.length} deals closed won
          </p>
        </div>

        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-nexus-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Pipeline Value</span>
            <IconTrendingUp size={18} className="text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-400">
            {loading ? "…" : formatRupees(totalPipelineValue)}
          </div>
          <p className="text-xs text-nexus-text-secondary font-medium">
            Across {totalDealsCount} pipeline deals
          </p>
        </div>

        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-nexus-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Weighted Forecast</span>
            <IconTarget size={18} className="text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-400">
            {loading ? "…" : formatRupees(Math.round(weightedForecast))}
          </div>
          <p className="text-xs text-purple-400 font-medium">Probability-adjusted revenue</p>
        </div>

        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-nexus-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Average Deal Size</span>
            <IconBriefcase size={18} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400">
            {loading ? "…" : formatRupees(avgDealSize)}
          </div>
          <p className="text-xs text-nexus-text-secondary font-medium">Win rate: {winRate}%</p>
        </div>
      </div>

      {/* Main Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue by Service Type */}
        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex justify-between items-center border-b border-nexus-border pb-3">
            <h3 className="text-base font-bold text-nexus-text flex items-center gap-2">
              <IconBriefcase size={20} className="text-[#10D078]" />
              Pipeline Value by Service Type
            </h3>
            <span className="text-xs font-semibold text-nexus-muted">Revenue Distribution</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-nexus-muted">Loading metrics…</div>
          ) : Object.keys(serviceRevenue).length === 0 ? (
            <div className="p-8 text-center text-xs text-nexus-muted border border-dashed border-nexus-border rounded-xl">
              No service revenue data
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(serviceRevenue).map(([stName, data]) => {
                const pct = totalPipelineValue > 0 ? Math.round((data.total / totalPipelineValue) * 100) : 0;

                return (
                  <div key={stName} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-nexus-text font-bold">{stName} ({data.count} deals)</span>
                      <span className="text-emerald-400 font-bold">{formatRupees(data.total)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-nexus-bg h-2.5 rounded-full overflow-hidden border border-nexus-border/60">
                      <div className="bg-gradient-to-r from-[#10D078] to-emerald-400 h-full transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rep Sales Contribution Table */}
        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-nexus-border pb-3">
            <h3 className="text-base font-bold text-nexus-text flex items-center gap-2">
              <IconAward size={20} className="text-purple-400" />
              Sales Rep Contribution & Performance
            </h3>
            <span className="text-xs font-semibold text-nexus-muted">{Object.keys(repPerformance).length} Reps</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-nexus-muted">Loading reps…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-bold">
                    <th className="py-2.5 px-3">Sales Rep</th>
                    <th className="py-2.5 px-3">Deals</th>
                    <th className="py-2.5 px-3">Total Value</th>
                    <th className="py-2.5 px-3 text-right">Won Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nexus-border/60">
                  {Object.values(repPerformance).map((rep) => (
                    <tr key={rep.name} className="hover:bg-nexus-hover/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-nexus-text flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold text-[10px]">
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        {rep.name}
                      </td>
                      <td className="py-3 px-3 text-nexus-muted font-semibold">{rep.dealsCount}</td>
                      <td className="py-3 px-3 font-bold text-sky-400">{formatRupees(rep.totalVal)}</td>
                      <td className="py-3 px-3 font-bold text-[#10D078] text-right">{formatRupees(rep.wonVal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 10-Stage Pipeline Velocity Table */}
      <div className="bg-nexus-card border border-nexus-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-nexus-text flex items-center gap-2 border-b border-nexus-border pb-3">
          <IconClock size={18} className="text-sky-400" />
          Full 10-Stage Pipeline Velocity Breakdown
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-bold">
                <th className="py-3 px-4">Stage Name</th>
                <th className="py-3 px-4">Deals</th>
                <th className="py-3 px-4">Stage Total Value</th>
                <th className="py-3 px-4">Weighted Value</th>
                <th className="py-3 px-4 text-right">% of Total Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nexus-border/60">
              {PIPELINE_STAGES.map((stg) => {
                const stageDeals = filteredDeals.filter((d) => d.stage === stg.id);
                const val = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
                const weighted = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0) * ((d.probability || 50) / 100), 0);
                const pct = totalPipelineValue > 0 ? ((val / totalPipelineValue) * 100).toFixed(1) : "0.0";

                return (
                  <tr key={stg.id} className="hover:bg-nexus-hover/30 transition-colors">
                    <td className={`py-3.5 px-4 font-extrabold ${stg.color}`}>{stg.label}</td>
                    <td className="py-3.5 px-4 font-bold text-nexus-text">{stageDeals.length}</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-400">{formatRupees(val)}</td>
                    <td className="py-3.5 px-4 font-bold text-purple-400">{formatRupees(Math.round(weighted))}</td>
                    <td className="py-3.5 px-4 font-bold text-nexus-muted text-right">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
