"use client";

import { useState, useEffect, useMemo } from "react";
import {
  IconAddressBook,
  IconLayoutDashboard,
  IconChartPie,
  IconTarget,
  IconTrendingUp,
  IconPhoneCall,
  IconAward,
  IconCreditCard,
  IconUsers,
  IconClock,
  IconChevronRight,
} from "@tabler/icons-react";
import { DateRangeFilter, filterByDateRange, DateRangeKey } from "@/components/common/DateRangeFilter";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

function formatRupees(val: number) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function LeadMetricsPage() {
  const { user } = useAuthStore();
  const isDashboardTitle = user?.role === "ADMIN" || user?.role === "USER";
  const [leads, setLeads] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Default to a broad window so the dashboard shows real data immediately instead of
  // looking empty just because nothing happened to be created "Today".
  const [dateRange, setDateRange] = useState<DateRangeKey>("LAST_MONTH");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/leads").then((res) => res.json()),
      fetch("/api/users").then((res) => res.json()),
    ])
      .then(([leadsData, usersData]) => {
        if (Array.isArray(leadsData)) setLeads(leadsData);
        if (Array.isArray(usersData)) setAllUsers(usersData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Filter leads by selected date range
  const filteredLeads = useMemo(() => {
    return filterByDateRange(leads, "createdAt", dateRange, startDate, endDate);
  }, [leads, dateRange, startDate, endDate]);

  // Helper: Extract follow up date
  const getNextFollowUpDate = (lead: any) => {
    if (!Array.isArray(lead.activities) || lead.activities.length === 0) return null;
    for (const act of lead.activities) {
      let rawDate = act.nextFollowUpDate;
      if (!rawDate && act.description) {
        try {
          const parsed = JSON.parse(act.description);
          rawDate = parsed.followUpDate || parsed.nextFollowUpDate;
        } catch (e) {}
      }
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  };

  // ── Calculated Clean Metrics ──
  const totalLeads = filteredLeads.length;

  const totalCashCollected = filteredLeads.reduce((sum, l) => {
    const totalPaid = Array.isArray(l.payments)
      ? l.payments
          .filter((p: any) => p.status === "PAID")
          .reduce((s: number, p: any) => s + parseFloat(p.amount.toString()), 0)
      : parseFloat(l.cashCollected?.toString() || "0");
    return sum + (totalPaid || 0);
  }, 0);

  const openLeads = filteredLeads.filter((l) => !["WON", "LOST"].includes(l.status));
  const openPipelineValue = openLeads.reduce(
    (sum, l) => sum + (parseFloat(l.revenueGenerated?.toString() || "0") || 0),
    0
  );

  const wonLeads = filteredLeads.filter((l) => l.status === "WON");
  const dealsWonCount = wonLeads.length;
  const dealsLostCount = filteredLeads.filter((l) => l.status === "LOST").length;
  const closedDealsTotal = dealsWonCount + dealsLostCount;
  const winRate = closedDealsTotal > 0 ? Math.round((dealsWonCount / closedDealsTotal) * 100) : 0;
  const avgWonDealValue = dealsWonCount > 0 ? totalCashCollected / dealsWonCount : 0;

  // Qualification Rate
  const qualifiedLeads = filteredLeads.filter((l) =>
    ["QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"].includes(l.status)
  ).length;
  const qualificationRate = totalLeads > 0 ? ((qualifiedLeads / totalLeads) * 100).toFixed(1) : "0.0";

  // Follow-up Health Analysis
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let overdueCount = 0;
  let dueTodayCount = 0;
  let upcomingCount = 0;
  let noFollowUpCount = 0;

  filteredLeads.forEach((l) => {
    const fup = getNextFollowUpDate(l);
    if (!fup) {
      noFollowUpCount++;
    } else {
      if (fup < today) overdueCount++;
      else if (fup >= today && fup < tomorrow) dueTodayCount++;
      else upcomingCount++;
    }
  });

  // Lead Sources Breakdown
  const sourceCounts: Record<string, number> = {};
  filteredLeads.forEach((l) => {
    const src = l.leadSource || "OTHER";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  // Lead Status Progression
  const STATUS_STAGES = [
    { key: "NEW", label: "New Leads", barColor: "bg-sky-500/20", textColor: "text-sky-400" },
    { key: "CONTACTED", label: "Contacted", barColor: "bg-indigo-500/20", textColor: "text-indigo-400" },
    { key: "QUALIFIED", label: "Qualified", barColor: "bg-[#10D078]/20", textColor: "text-[#10D078]" },
    { key: "PROPOSAL", label: "Proposal", barColor: "bg-purple-500/20", textColor: "text-purple-400" },
    { key: "NEGOTIATION", label: "Negotiation", barColor: "bg-amber-500/20", textColor: "text-amber-400" },
    { key: "WON", label: "Won / Converted", barColor: "bg-emerald-500/20", textColor: "text-emerald-400" },
    { key: "LOST", label: "Lost", barColor: "bg-rose-500/20", textColor: "text-rose-400" },
  ];

  const statusCounts: Record<string, number> = {};
  filteredLeads.forEach((l) => {
    const st = l.status || "NEW";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  // Assignee Performance Breakdown
  const userPerformanceMap: Record<
    string,
    {
      name: string;
      role?: string;
      total: number;
      won: number;
      lost: number;
      revenue: number;
      openPipeline: number;
      pendingFollowUps: number;
    }
  > = {};

  // Pre-populate with all active company team members
  allUsers
    .filter((u) => u.status === "ACTIVE" && !u.isDeleted)
    .forEach((u) => {
      if (u.name && !userPerformanceMap[u.name]) {
        userPerformanceMap[u.name] = {
          name: u.name,
          role: u.role || "",
          total: 0,
          won: 0,
          lost: 0,
          revenue: 0,
          openPipeline: 0,
          pendingFollowUps: 0,
        };
      }
    });

  filteredLeads.forEach((l) => {
    const userName = l.user?.name || "Unassigned";
    const userRole = l.user?.role || "";
    if (!userPerformanceMap[userName]) {
      userPerformanceMap[userName] = {
        name: userName,
        role: userRole,
        total: 0,
        won: 0,
        lost: 0,
        revenue: 0,
        openPipeline: 0,
        pendingFollowUps: 0,
      };
    }
    const item = userPerformanceMap[userName];
    item.total++;

    if (l.status === "WON") {
      item.won++;
      const paid = Array.isArray(l.payments)
        ? l.payments
            .filter((p: any) => p.status === "PAID")
            .reduce((s: number, p: any) => s + parseFloat(p.amount.toString()), 0)
        : parseFloat(l.cashCollected?.toString() || "0");
      item.revenue += paid || 0;
    } else if (l.status === "LOST") {
      item.lost++;
    } else {
      item.openPipeline += parseFloat(l.revenueGenerated?.toString() || "0") || 0;
    }

    if (getNextFollowUpDate(l)) {
      item.pendingFollowUps++;
    }
  });

  const userPerformanceList = Object.values(userPerformanceMap).sort((a, b) => {
    const aIsAdmin = a.role === "SUPER_ADMIN" || a.role === "ADMIN";
    const bIsAdmin = b.role === "SUPER_ADMIN" || b.role === "ADMIN";

    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    return b.total - a.total;
  });

  return (
    <div className="space-y-6 text-nexus-text font-sans pb-10">
      {/* Top Header Bar with Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-nexus-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-nexus-text tracking-tight flex items-center gap-2">
            {isDashboardTitle ? (
              <IconLayoutDashboard size={20} className="text-[#10D078]" />
            ) : (
              <IconAddressBook size={20} className="text-[#10D078]" />
            )}
            {isDashboardTitle ? "Dashboard" : "Lead Metrics & Analytics"}
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            Clear overview of lead volume, conversion performance, and team distribution.
          </p>
        </div>

        <DateRangeFilter
          value={dateRange}
          startDate={startDate}
          endDate={endDate}
          excludeKeys={["ALL"]}
          onChange={(val, s, e) => {
            setDateRange(val);
            if (s !== undefined) setStartDate(s);
            if (e !== undefined) setEndDate(e);
          }}
        />
      </div>

      {/* 4 Metric Cards with Subtle Color Accents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-nexus-text-secondary font-medium">
            <span>Total Leads</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <IconUsers size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-nexus-text mt-1">{loading ? "…" : totalLeads}</div>
          <div className="text-xs text-indigo-400 font-medium mt-1">{qualificationRate}% Qualified</div>
        </div>

        {/* Revenue Generated */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-nexus-text-secondary font-medium">
            <span>Revenue Generated</span>
            <div className="p-1.5 rounded-lg bg-[#10D078]/10 border border-[#10D078]/20 text-[#10D078]">
              <IconCreditCard size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#10D078] mt-1">{loading ? "…" : formatRupees(totalCashCollected)}</div>
          <div className="text-xs text-emerald-400/90 font-medium mt-1">Avg deal: {formatRupees(avgWonDealValue)}</div>
        </div>

        {/* Open Pipeline */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-nexus-text-secondary font-medium">
            <span>Open Pipeline</span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <IconTrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{loading ? "…" : formatRupees(openPipelineValue)}</div>
          <div className="text-xs text-sky-400/80 font-medium mt-1">{openLeads.length} open opportunities</div>
        </div>

        {/* Deals Won */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-nexus-text-secondary font-medium">
            <span>Deals Won</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <IconAward size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-nexus-text mt-1 flex items-baseline justify-between">
            <span>{loading ? "…" : dealsWonCount}</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              {winRate}% win rate
            </span>
          </div>
          <div className="text-xs text-nexus-muted mt-1">{dealsWonCount} of {closedDealsTotal} closed</div>
        </div>
      </div>

      {/* Follow-up Summary Row with Color Variations */}
      <div className="bg-nexus-card border border-nexus-border rounded-xl p-4">
        <div className="flex items-center justify-between border-b border-nexus-border pb-2 mb-3">
          <span className="text-xs font-bold text-nexus-text flex items-center gap-1.5">
            <IconClock size={16} className="text-amber-400" />
            Follow-Up Status Summary
          </span>
          <Link href="/leads/crm" className="text-xs text-[#10D078] font-semibold hover:underline flex items-center gap-1">
            CRM Table <IconChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-lg p-2.5">
            <span className="text-rose-400 font-semibold block text-[11px]">Overdue</span>
            <span className="text-base font-bold text-rose-400">{overdueCount}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5">
            <span className="text-amber-400 font-semibold block text-[11px]">Due Today</span>
            <span className="text-base font-bold text-amber-400">{dueTodayCount}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-2.5">
            <span className="text-emerald-400 font-semibold block text-[11px]">Upcoming</span>
            <span className="text-base font-bold text-emerald-400">{upcomingCount}</span>
          </div>
          <div className="bg-nexus-hover/50 border border-nexus-border rounded-lg p-2.5">
            <span className="text-nexus-muted font-medium block text-[11px]">Unscheduled</span>
            <span className="text-base font-bold text-nexus-muted">{noFollowUpCount}</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Funnel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Channel Breakdown */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-nexus-border pb-3">
            <h3 className="text-sm font-bold text-nexus-text flex items-center gap-2">
              <IconChartPie size={18} className="text-[#10D078]" />
              Lead Acquisition Channels
            </h3>
            <span className="text-xs text-nexus-muted">{Object.keys(sourceCounts).length} Channels</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-xs text-nexus-muted">Loading metrics…</div>
          ) : totalLeads === 0 ? (
            <div className="p-6 text-center text-xs text-nexus-muted border border-dashed border-nexus-border rounded-lg">
              No lead data available
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(sourceCounts).map(([source, count]) => {
                const pct = Math.round((count / totalLeads) * 100);
                const displaySource = source.replace("_", " ");

                return (
                  <div key={source} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-nexus-text font-medium capitalize">{displaySource}</span>
                      <span className="text-nexus-muted">
                        <strong className="text-nexus-text">{count}</strong> ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-nexus-hover h-2 rounded-full overflow-hidden border border-nexus-border/40">
                      <div className="bg-[#10D078] h-full transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead Status Progression Funnel */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-nexus-border pb-3">
            <h3 className="text-sm font-bold text-nexus-text flex items-center gap-2">
              <IconTarget size={18} className="text-[#10D078]" />
              Lead Conversion Pipeline
            </h3>
            <span className="text-xs text-nexus-muted">7 Funnel Stages</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-xs text-nexus-muted">Loading funnel…</div>
          ) : (
            <div className="space-y-2.5">
              {STATUS_STAGES.map((stg) => {
                const count = statusCounts[stg.key] || 0;
                const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;

                return (
                  <div key={stg.key} className="flex items-center gap-3 text-xs">
                    <span className="w-28 font-medium text-nexus-text-secondary truncate">{stg.label}</span>
                    <div className="flex-1 bg-nexus-hover h-6 rounded-lg overflow-hidden relative flex items-center px-2.5 border border-nexus-border/50">
                      <div className={`${stg.barColor} absolute inset-y-0 left-0 transition-all duration-300`} style={{ width: `${Math.max(pct, 3)}%` }} />
                      <span className={`relative text-xs font-semibold ${stg.textColor}`}>
                        {count} Leads {pct > 0 ? `(${pct}%)` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Assignee Performance Report Table */}
      <div className="bg-nexus-card border border-nexus-border rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-nexus-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-nexus-text flex items-center gap-2">
              <IconUsers size={18} className="text-[#10D078]" />
              Assignee Lead Distribution & Performance
            </h3>
          </div>
          <span className="text-xs text-nexus-muted font-medium px-2.5 py-0.5 bg-nexus-hover rounded-md border border-nexus-border self-start sm:self-auto">
            {userPerformanceList.length} Representatives
          </span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-nexus-muted">Loading performance report…</div>
        ) : userPerformanceList.length === 0 ? (
          <div className="p-6 text-center text-xs text-nexus-muted border border-dashed border-nexus-border rounded-lg">
            No assignee data available
          </div>
        ) : (
          <div className="overflow-x-auto border border-nexus-border rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-nexus-hover/80 text-nexus-text-secondary font-semibold border-b border-nexus-border">
                <tr>
                  <th className="py-2.5 px-3">Representative</th>
                  <th className="py-2.5 px-3 text-center">Total Assigned</th>
                  <th className="py-2.5 px-3 text-center">Deals Won</th>
                  <th className="py-2.5 px-3 text-center">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Revenue Generated</th>
                  <th className="py-2.5 px-3 text-right">Open Pipeline</th>
                  <th className="py-2.5 px-3 text-center">Pending Follow-ups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border/50">
                {userPerformanceList.map((rep) => {
                  const closedTotal = rep.won + rep.lost;
                  const winRatePct = closedTotal > 0 ? Math.round((rep.won / closedTotal) * 100) : rep.total > 0 ? Math.round((rep.won / rep.total) * 100) : 0;

                  return (
                    <tr key={rep.name} className="hover:bg-nexus-hover/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-nexus-text flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#10D078]/15 border border-[#10D078]/30 text-[#10D078] flex items-center justify-center font-bold text-[11px] shrink-0">
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{rep.name}</span>
                          <span
                            className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                              rep.role === "ADMIN" || rep.role === "SUPER_ADMIN"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            }`}
                          >
                            {rep.role === "ADMIN" || rep.role === "SUPER_ADMIN" ? "Admin" : "User"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-nexus-text">{rep.total}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-nexus-text">{rep.won}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-[#10D078]">
                        {winRatePct}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#10D078]">
                        {formatRupees(rep.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-nexus-text">
                        {formatRupees(rep.openPipeline)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-nexus-text">
                        {rep.pendingFollowUps}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-nexus-hover/60 font-bold border-t border-nexus-border text-nexus-text">
                <tr>
                  <td className="py-2.5 px-3">Total Portfolio</td>
                  <td className="py-2.5 px-3 text-center">{totalLeads}</td>
                  <td className="py-2.5 px-3 text-center">{dealsWonCount}</td>
                  <td className="py-2.5 px-3 text-center text-[#10D078]">{winRate}%</td>
                  <td className="py-2.5 px-3 text-right text-[#10D078]">{formatRupees(totalCashCollected)}</td>
                  <td className="py-2.5 px-3 text-right">{formatRupees(openPipelineValue)}</td>
                  <td className="py-2.5 px-3 text-center">{overdueCount + dueTodayCount + upcomingCount}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
