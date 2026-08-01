"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  IconShieldCheck,
  IconSearch,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconClock,
  IconDownload,
  IconX,
  IconEye,
  IconFlame,
  IconFilter,
  IconToggleLeft,
  IconToggleRight,
  IconCalendar,
  IconDatabase,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  action: string;
  category: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  actorName: string;
  actorEmail: string;
  actorRole?: string;
  targetName?: string;
  summary: string;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatShortDate(d: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  SUCCESS: { label: "Success",  bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/25", icon: IconCheck        },
  INFO:    { label: "Info",     bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/25",    icon: IconInfoCircle   },
  WARNING: { label: "Warning",  bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/25",   icon: IconAlertTriangle},
  DANGER:  { label: "Critical", bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/25",     icon: IconFlame        },
};

const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: "User Login", USER_LOGOUT: "User Logout", LOGIN_FAILED: "Login Failed",
  USER_CREATED: "User Created", USER_DELETED: "User Deleted",
  PASSWORD_RESET: "Password Reset", PASSWORD_CHANGED: "Password Changed",
  ROLE_UPDATED: "Role Updated", STATUS_TOGGLED: "Status Toggled",
  LEAD_CREATED: "Lead Created", LEAD_UPDATED: "Lead Updated", LEAD_DELETED: "Lead Deleted",
  DEAL_CREATED: "Deal Created", DEAL_UPDATED: "Deal Updated", DEAL_DELETED: "Deal Deleted",
  PERMISSIONS_UPDATED: "Permissions Updated",
  API_KEY_CREATED: "API Key Created", API_KEY_DELETED: "API Key Deleted",
};

// ─── Date Range Picker Component ─────────────────────────────────────────────

interface DateRangePickerProps {
  from: Date | null;
  to: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
  onClear: () => void;
}

function DateRangePicker({ from, to, onChange, onClear }: DateRangePickerProps) {
  const today = startOfDay(new Date());
  const [open, setOpen]       = useState(false);
  const [hovered, setHovered] = useState<Date | null>(null);
  // Left month = current month, right = next month
  const [leftYear,  setLeftYear]  = useState(today.getFullYear());
  const [leftMonth, setLeftMonth] = useState(today.getMonth());
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Right panel is always 1 month ahead of left
  const rightMonth = leftMonth === 11 ? 0  : leftMonth + 1;
  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function prevMonth() {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
    else setLeftMonth(m => m - 1);
  }
  function nextMonth() {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
    else setLeftMonth(m => m + 1);
  }

  function handleDayClick(day: Date) {
    if (selecting === "from" || !from) {
      onChange(startOfDay(day), null);
      setSelecting("to");
    } else {
      // Clicking before the from-date swaps them
      if (day < from) {
        onChange(startOfDay(day), startOfDay(from));
      } else {
        onChange(from, startOfDay(day));
      }
      setSelecting("from");
      setOpen(false);
    }
  }

  function isInRange(day: Date): boolean {
    const start = from;
    const end   = selecting === "to" ? (hovered || to) : to;
    if (!start || !end) return false;
    const lo = start < end ? start : end;
    const hi = start < end ? end   : start;
    return day > lo && day < hi;
  }

  function isRangeStart(day: Date) { return !!from && isSameDay(day, from); }
  function isRangeEnd(day: Date)   { return !!to   && isSameDay(day, to);   }
  function isHoverEnd(day: Date)   { return selecting === "to" && !!hovered && isSameDay(day, hovered); }

  function buildCalendar(year: number, month: number) {
    const first   = new Date(year, month, 1).getDay();
    const daysInM = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(first).fill(null);
    for (let d = 1; d <= daysInM; d++) cells.push(new Date(year, month, d));
    // Pad to complete rows
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function renderMonth(year: number, month: number, showPrev: boolean, showNext: boolean) {
    const cells = buildCalendar(year, month);
    return (
      <div className="w-60">
        {/* Month header */}
        <div className="flex items-center justify-between px-1 mb-3">
          {showPrev
            ? <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-nexus-hover text-nexus-muted hover:text-nexus-text transition-colors"><IconChevronLeft size={14} /></button>
            : <div className="w-7" />}
          <span className="text-sm font-bold text-nexus-text">
            {MONTHS[month]} {year}
          </span>
          {showNext
            ? <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-nexus-hover text-nexus-muted hover:text-nexus-text transition-colors"><IconChevronRight size={14} /></button>
            : <div className="w-7" />}
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-nexus-muted py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const isStart  = isRangeStart(day);
            const isEnd    = isRangeEnd(day) || isHoverEnd(day);
            const inRange  = isInRange(day);
            const isToday  = isSameDay(day, today);
            const isFuture = day > today;

            let cls = "relative w-full aspect-square flex items-center justify-center text-xs rounded-full transition-colors select-none ";

            if (isStart || isEnd) {
              cls += "bg-nexus-primary text-white font-bold ";
            } else if (inRange) {
              cls += "bg-nexus-primary/15 text-nexus-text rounded-none ";
            } else if (isToday) {
              cls += "border border-nexus-primary/40 text-nexus-primary font-semibold ";
            } else if (isFuture) {
              cls += "text-nexus-muted cursor-not-allowed opacity-40 ";
            } else {
              cls += "text-nexus-text hover:bg-nexus-hover cursor-pointer ";
            }

            return (
              <button
                key={i}
                disabled={isFuture}
                className={cls}
                onClick={() => !isFuture && handleDayClick(day)}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
              >
                {day.getDate()}
                {isToday && !isStart && !isEnd && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-nexus-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Quick presets
  function preset(days: number) {
    const t = startOfDay(new Date());
    const f = new Date(t);
    f.setDate(f.getDate() - days + 1);
    onChange(f, t);
    setSelecting("from");
    setOpen(false);
  }

  const label = from
    ? to
      ? `${formatShortDate(from)} – ${formatShortDate(to)}`
      : `From ${formatShortDate(from)}…`
    : "Pick date range";

  return (
    <div className="relative" ref={pickerRef}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(o => !o); setSelecting("from"); }}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
          from
            ? "bg-nexus-primary/10 border-nexus-primary/30 text-nexus-primary"
            : "bg-nexus-bg border-nexus-border text-nexus-muted hover:text-nexus-text hover:border-nexus-primary/40"
        }`}
      >
        <IconCalendar size={14} />
        <span className="text-xs font-medium whitespace-nowrap">{label}</span>
        {from && (
          <span
            role="button"
            className="ml-1 text-nexus-primary/60 hover:text-nexus-primary"
            onClick={(e) => { e.stopPropagation(); onClear(); setSelecting("from"); }}
          >
            <IconX size={12} />
          </span>
        )}
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl p-4 min-w-max">

          {/* Hint text */}
          <p className="text-[11px] text-nexus-muted mb-3 text-center">
            {selecting === "from" ? "Select start date" : "Select end date"}
          </p>

          {/* Two-month calendar */}
          <div className="flex gap-6">
            {renderMonth(leftYear,  leftMonth,  true,  false)}
            <div className="w-px bg-nexus-border" />
            {renderMonth(rightYear, rightMonth, false, true )}
          </div>

          {/* Quick presets */}
          <div className="mt-4 pt-3 border-t border-nexus-border flex flex-wrap gap-2">
            {[
              { label: "Today",      days: 1   },
              { label: "Last 7d",    days: 7   },
              { label: "Last 30d",   days: 30  },
              { label: "Last 90d",   days: 90  },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => preset(days)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-nexus-border text-nexus-muted hover:bg-nexus-primary/10 hover:text-nexus-primary hover:border-nexus-primary/30 transition-colors"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => { onClear(); setSelecting("from"); }}
              className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg border border-nexus-border text-nexus-muted hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [logs, setLogs]                         = useState<AuditLog[]>([]);
  const [allLogs, setAllLogs]                   = useState<AuditLog[]>([]);
  const [allCategories, setAllCategories]       = useState<string[]>([]);
  const [allActions, setAllActions]             = useState<string[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [search, setSearch]                     = useState("");
  const [filterCategory, setFilterCategory]     = useState("");
  const [filterSeverity, setFilterSeverity]     = useState("");
  const [filterAction, setFilterAction]         = useState("");
  const [dateFrom, setDateFrom]                 = useState<Date | null>(null);
  const [dateTo, setDateTo]                     = useState<Date | null>(null);
  const [viewLog, setViewLog]                   = useState<AuditLog | null>(null);
  const [autoRefresh, setAutoRefresh]           = useState(false);
  const intervalRef                             = useRef<NodeJS.Timeout | null>(null);

  const token = () =>
    typeof window !== "undefined" ? localStorage.getItem("nexus-token") || "" : "";

  // Fetch ALL logs from the server — filtering is client-side
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/audit-logs`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllLogs(data);
        setAllCategories(Array.from(new Set(data.map((l: AuditLog) => l.category))).sort() as string[]);
        setAllActions(Array.from(new Set(data.map((l: AuditLog) => l.action))).sort() as string[]);
      }
    } catch {
      console.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, []);

  // Client-side filtering — instant, no network request
  useEffect(() => {
    let filtered = allLogs;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((l) =>
        l.actorName.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.targetName || "").toLowerCase().includes(q)
      );
    }

    if (filterCategory) filtered = filtered.filter((l) => l.category === filterCategory);
    if (filterSeverity) filtered = filtered.filter((l) => l.severity === filterSeverity);
    if (filterAction)   filtered = filtered.filter((l) => l.action   === filterAction);

    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((l) => new Date(l.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((l) => new Date(l.createdAt) <= to);
    }

    setLogs(filtered);
  }, [allLogs, search, filterCategory, filterSeverity, filterAction, dateFrom, dateTo]);

  // Initial fetch
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh every 30 s
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 30_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  // Export CSV — current filtered view
  function exportCSV() {
    const headers = ["Timestamp","Performed By","Role","Action","Category","Target","Summary","Severity","IP"];
    const rows    = logs.map((l) => [
      formatDateTime(l.createdAt),
      `${l.actorName} (${l.actorEmail})`,
      l.actorRole || "",
      ACTION_LABELS[l.action] || l.action,
      l.category, l.targetName || "", l.summary, l.severity, l.ipAddress || "",
    ]);
    const csv  = "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  function clearFilters() {
    setSearch(""); setFilterCategory(""); setFilterSeverity("");
    setFilterAction(""); setDateFrom(null); setDateTo(null);
  }

  const hasActiveFilters = search || filterCategory || filterSeverity || filterAction || dateFrom || dateTo;

  return (
    <PermissionGuard roles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="space-y-6 text-nexus-text">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-nexus-primary/20 to-nexus-primary/10 rounded-xl border border-nexus-primary/20 text-nexus-primary">
                <IconShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-nexus-text">Audit Logs</h1>
                <p className="text-sm text-nexus-text-secondary mt-0.5">
                  Real-time record of all system actions, security events, and user activity.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                autoRefresh
                  ? "bg-nexus-primary/10 border-nexus-primary/30 text-nexus-primary"
                  : "bg-nexus-card border-nexus-border text-nexus-muted hover:text-nexus-text"
              }`}
            >
              {autoRefresh ? <IconToggleRight size={15} /> : <IconToggleLeft size={15} />}
              Auto-refresh
            </button>

            <button
              onClick={fetchLogs}
              className="p-2 rounded-lg border border-nexus-border text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover transition-colors"
              title="Refresh now"
            >
              <IconRefresh size={16} className={loading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-nexus-card border border-nexus-border text-nexus-text hover:bg-nexus-hover text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <IconDownload size={16} />
              Export CSV
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Events",     value: allLogs.length,                                         color: "blue",    Icon: IconClock         },
            { label: "Success",          value: allLogs.filter((l) => l.severity === "SUCCESS").length, color: "emerald", Icon: IconCheck         },
            { label: "Warnings",         value: allLogs.filter((l) => l.severity === "WARNING").length, color: "amber",   Icon: IconAlertTriangle },
            { label: "Critical Actions", value: allLogs.filter((l) => l.severity === "DANGER").length,  color: "red",     Icon: IconFlame         },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="bg-nexus-card border border-nexus-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 text-${color}-400 flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-[11px] text-nexus-muted font-semibold uppercase">{label}</p>
                <p className={`text-xl font-bold text-${color === "blue" ? "nexus-text" : `${color}-400`}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── FILTERS ─────────────────────────────────────────────────────── */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-nexus-muted uppercase">
            <IconFilter size={13} />
            Filters
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md bg-nexus-hover text-nexus-text hover:bg-red-500/10 hover:text-red-400 transition-colors normal-case font-medium"
              >
                <IconX size={11} /> Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by action, user, target, or summary…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary"
              />
            </div>

            {/* Category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary"
            >
              <option value="">All Categories</option>
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Action */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary"
            >
              <option value="">All Actions</option>
              {allActions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
              ))}
            </select>

            {/* Severity */}
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary"
            >
              <option value="">All Severities</option>
              <option value="SUCCESS">Success</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="DANGER">Critical</option>
            </select>

            {/* Date Range Picker */}
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
              onClear={() => { setDateFrom(null); setDateTo(null); }}
            />

            <span className="text-xs text-nexus-muted ml-auto whitespace-nowrap">
              Showing {logs.length} of {allLogs.length} event{allLogs.length !== 1 ? "s" : ""}
              {hasActiveFilters ? " (filtered)" : ""}
            </span>
          </div>
        </div>

        {/* ── AUDIT LOGS TABLE ─────────────────────────────────────────────── */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[850px]">
              <thead>
                <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/40">
                  <th className="px-5 py-3">Date & Time</th>
                  <th className="px-5 py-3">Performed By</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Summary</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border">
                {loading && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-2 border-nexus-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-nexus-bg border border-nexus-border flex items-center justify-center">
                          <IconDatabase size={28} className="text-nexus-muted opacity-50" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-nexus-text">No audit events found</p>
                          <p className="text-xs text-nexus-muted mt-1 max-w-xs mx-auto">
                            {hasActiveFilters
                              ? "No events match your current filters. Try adjusting the date range or other filters."
                              : "Events appear here as users log in, create leads, manage deals, and perform other actions."}
                          </p>
                        </div>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="px-4 py-2 text-xs font-semibold bg-nexus-hover border border-nexus-border rounded-lg hover:bg-nexus-primary/10 hover:text-nexus-primary hover:border-nexus-primary/30 transition-colors"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && logs.map((log) => {
                  const sev     = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.INFO;
                  const SevIcon = sev.icon;
                  return (
                    <tr key={log.id} className="hover:bg-nexus-hover/40 transition-colors">
                      <td className="px-5 py-4 text-xs font-medium text-nexus-text whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-nexus-primary/10 text-nexus-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(log.actorName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-nexus-text leading-tight">{log.actorName}</p>
                            <p className="text-[10px] text-nexus-muted">{log.actorEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold text-nexus-text">{ACTION_LABELS[log.action] || log.action}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-nexus-bg border border-nexus-border text-nexus-text-secondary">
                          {log.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-nexus-text-secondary max-w-xs truncate" title={log.summary}>
                        {log.summary}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
                          <SevIcon size={11} />{sev.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setViewLog(log)}
                          className="p-1.5 rounded-lg text-nexus-muted hover:text-nexus-primary hover:bg-nexus-primary/10 transition-colors"
                          title="View Log Details"
                        >
                          <IconEye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── VIEW LOG DETAILS MODAL ────────────────────────────────────────── */}
        {viewLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-6 py-5 border-b border-nexus-border">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
                    <IconShieldCheck size={20} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-nexus-text">Audit Log Entry</h2>
                    <p className="text-xs text-nexus-muted">{formatDateTime(viewLog.createdAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewLog(null)}
                  className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"
                >
                  <IconX size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-sm">
                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-1">Performed By</p>
                  <div className="p-3 bg-nexus-bg border border-nexus-border rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-nexus-primary/15 text-nexus-primary font-bold flex items-center justify-center text-sm">
                      {(viewLog.actorName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-nexus-text text-xs">{viewLog.actorName}</p>
                      <p className="text-[11px] text-nexus-muted">{viewLog.actorEmail}</p>
                      {viewLog.actorRole && (
                        <p className="text-[10px] text-nexus-muted mt-0.5 uppercase font-semibold">{viewLog.actorRole}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase mb-0.5">Action</p>
                    <p className="font-bold text-nexus-text text-xs">{ACTION_LABELS[viewLog.action] || viewLog.action}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase mb-0.5">Category</p>
                    <p className="font-semibold text-nexus-text text-xs">{viewLog.category}</p>
                  </div>
                </div>

                {viewLog.targetName && (
                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase mb-0.5">Target Subject</p>
                    <p className="font-semibold text-nexus-text text-xs">{viewLog.targetName}</p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase mb-0.5">Summary</p>
                  <p className="p-3 bg-nexus-bg border border-nexus-border rounded-xl text-xs text-nexus-text leading-relaxed font-medium">
                    {viewLog.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase mb-0.5">Severity</p>
                    {(() => {
                      const sev = SEVERITY_CONFIG[viewLog.severity] || SEVERITY_CONFIG.INFO;
                      const SevIcon = sev.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
                          <SevIcon size={11} />{sev.label}
                        </span>
                      );
                    })()}
                  </div>
                  {viewLog.ipAddress && (
                    <div>
                      <p className="text-[10px] text-nexus-muted font-semibold uppercase mb-0.5">IP Address</p>
                      <code className="text-xs font-mono text-nexus-muted">{viewLog.ipAddress}</code>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end px-6 py-4 border-t border-nexus-border">
                <button
                  onClick={() => setViewLog(null)}
                  className="px-4 py-2 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
