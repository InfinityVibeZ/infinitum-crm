"use client";

import { useState } from "react";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";

export type DateRangeKey =
  | "ALL"
  | "TODAY"
  | "YESTERDAY"
  | "LAST_WEEK"
  | "LAST_MONTH"
  | "LAST_2_MONTHS"
  | "LAST_6_MONTHS"
  | "LAST_1_YEAR"
  | "CUSTOM";

interface DateRangeFilterProps {
  value: DateRangeKey;
  onChange: (val: DateRangeKey, startDate?: string, endDate?: string) => void;
  startDate?: string;
  endDate?: string;
  className?: string;
  excludeKeys?: DateRangeKey[];
}

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "ALL", label: "All Time" },
  { key: "TODAY", label: "Today" },
  { key: "YESTERDAY", label: "Yesterday" },
  { key: "LAST_WEEK", label: "Last 7 Days" },
  { key: "LAST_MONTH", label: "Last 30 Days (1 Month)" },
  { key: "LAST_2_MONTHS", label: "Last 2 Months" },
  { key: "LAST_6_MONTHS", label: "Last 6 Months" },
  { key: "LAST_1_YEAR", label: "Last 1 Year" },
  { key: "CUSTOM", label: "Custom Date Range…" },
];

export function DateRangeFilter({
  value,
  onChange,
  startDate = "",
  endDate = "",
  className = "",
  excludeKeys = [],
}: DateRangeFilterProps) {
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const handleSelectChange = (val: DateRangeKey) => {
    if (val === "CUSTOM") {
      onChange(val, customStart, customEnd);
    } else {
      onChange(val);
    }
  };

  const handleStartChange = (s: string) => {
    setCustomStart(s);
    if (value === "CUSTOM") {
      onChange("CUSTOM", s, customEnd);
    }
  };

  const handleEndChange = (e: string) => {
    setCustomEnd(e);
    if (value === "CUSTOM") {
      onChange("CUSTOM", customStart, e);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="relative inline-flex items-center">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-primary pointer-events-none flex items-center gap-1.5">
          <IconCalendar size={16} />
        </div>
        <select
          value={value}
          onChange={(e) => handleSelectChange(e.target.value as DateRangeKey)}
          className="bg-[#0B0F19] border border-[#151B2C] rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-nexus-text hover:border-nexus-primary/50 focus:outline-none focus:border-nexus-primary appearance-none cursor-pointer shadow-sm transition-all"
        >
          {DATE_RANGE_OPTIONS.filter((opt) => !excludeKeys.includes(opt.key)).map((opt) => (
            <option key={opt.key} value={opt.key} className="bg-[#0B0F19] text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nexus-muted pointer-events-none">
          <IconChevronDown size={14} />
        </div>
      </div>

      {value === "CUSTOM" && (
        <div className="flex items-center gap-2 bg-[#0B0F19] border border-[#151B2C] rounded-xl px-3 py-1.5 text-xs text-nexus-text shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-nexus-muted uppercase">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => handleStartChange(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }}
              className="bg-transparent text-nexus-primary font-bold focus:outline-none text-xs cursor-pointer border-b border-nexus-primary/30 pb-0.5"
            />
          </div>
          <span className="text-nexus-muted font-bold">→</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-nexus-muted uppercase">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => handleEndChange(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }}
              className="bg-transparent text-nexus-primary font-bold focus:outline-none text-xs cursor-pointer border-b border-nexus-primary/30 pb-0.5"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function filterByDateRange<T>(
  items: T[],
  dateField: keyof T,
  range: DateRangeKey,
  startDate?: string,
  endDate?: string
): T[] {
  if (range === "ALL" || !items || !Array.isArray(items)) return items;

  const now = new Date();

  // Start of Today (00:00:00.000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Start of Yesterday & End of Yesterday
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);

  // Last 7 days
  const lastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Last 30 days
  const lastMonthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Last 2 Months (60 days)
  const last2MonthsStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Last 6 Months (180 days)
  const last6MonthsStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  // Last 1 Year (365 days)
  const last1YearStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const customStartObj = startDate ? new Date(startDate) : null;
  const customEndObj = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

  return items.filter((item) => {
    const rawVal = item[dateField];
    if (!rawVal) return false;
    const itemDate = new Date(rawVal as any);
    if (isNaN(itemDate.getTime())) return false;

    switch (range) {
      case "TODAY":
        return itemDate >= todayStart;
      case "YESTERDAY":
        return itemDate >= yesterdayStart && itemDate <= yesterdayEnd;
      case "LAST_WEEK":
        return itemDate >= lastWeekStart;
      case "LAST_MONTH":
        return itemDate >= lastMonthStart;
      case "LAST_2_MONTHS":
        return itemDate >= last2MonthsStart;
      case "LAST_6_MONTHS":
        return itemDate >= last6MonthsStart;
      case "LAST_1_YEAR":
        return itemDate >= last1YearStart;
      case "CUSTOM":
        if (customStartObj && itemDate < customStartObj) return false;
        if (customEndObj && itemDate > customEndObj) return false;
        return true;
      default:
        return true;
    }
  });
}
