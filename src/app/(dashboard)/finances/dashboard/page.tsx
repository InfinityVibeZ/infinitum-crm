"use client";

import { IconCash } from "@tabler/icons-react";

export default function FinancialDashboardPage() {
  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
            <IconCash size={24} />
          </span>
          Financial Dashboard
        </h1>
        <p className="text-xs text-nexus-text-secondary mt-1">
          Complete cash flow overview, profit margins, and revenue analytics.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Total Revenue</span>
          <div className="text-2xl font-bold mt-1 text-[#10D078]">₹1,84,500.00</div>
          <span className="text-[11px] text-[#10D078] mt-1 block">↑ 14% this quarter</span>
        </div>
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Cash Collected</span>
          <div className="text-2xl font-bold mt-1 text-[#38BDF8]">₹1,37,000.00</div>
          <span className="text-[11px] text-sky-400 mt-1 block">Actual bank cash in</span>
        </div>
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Total Expenses</span>
          <div className="text-2xl font-bold mt-1 text-rose-400">₹28,400.00</div>
          <span className="text-[11px] text-nexus-muted mt-1 block">Ad spend & software</span>
        </div>
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Net Operating Margin</span>
          <div className="text-2xl font-bold mt-1 text-purple-400">79.2%</div>
          <span className="text-[11px] text-[#10D078] mt-1 block">High margin business</span>
        </div>
      </div>
    </div>
  );
}
