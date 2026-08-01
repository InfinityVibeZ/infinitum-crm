"use client";

import { IconChartBar, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function SOPPerformancePage() {
  const performanceData = [
    {
      sopName: "Closing Framework & Deposit Collection",
      usedByRepsRate: "8.0% Close Rate",
      unusedByRepsRate: "4.2% Close Rate",
      impactBoost: "+90.5% Lift",
      revenueGenerated: "₹200,000/mo",
    },
    {
      sopName: "15-Minute Discovery Qualification",
      usedByRepsRate: "32.0% Qualified Rate",
      unusedByRepsRate: "18.5% Qualified Rate",
      impactBoost: "+73.0% Lift",
      revenueGenerated: "₹145,000/mo",
    },
    {
      sopName: "Permission Openers & Objection Scripts",
      usedByRepsRate: "24.5% Show Rate",
      unusedByRepsRate: "14.0% Show Rate",
      impactBoost: "+75.0% Lift",
      revenueGenerated: "₹95,000/mo",
    },
  ];

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div className="flex items-center gap-3">
        <Link
          href="/team/knowledge-base"
          className="p-2 bg-[#0B0F19] border border-[#151B2C] rounded-lg text-nexus-muted hover:text-white transition-colors"
        >
          <IconArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconChartBar size={24} />
            </span>
            SOP Performance & ROI Analytics
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            Direct correlation between SOP usage, conversion lift (+90% close rate impact), and monthly revenue ROI.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Total Revenue Lift</span>
          <div className="text-2xl font-bold mt-1 text-[#10D078]">+₹200,000 / mo</div>
          <span className="text-[11px] text-[#10D078] mt-1 block">Proven ROI from SOP usage</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Avg Close Rate Lift</span>
          <div className="text-2xl font-bold mt-1 text-[#38BDF8]">+90.5%</div>
          <span className="text-[11px] text-sky-400 mt-1 block">SOP users vs non-users</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Team Adoption Rate</span>
          <div className="text-2xl font-bold mt-1 text-amber-400">89.2%</div>
          <span className="text-[11px] text-amber-400 mt-1 block">Active playbook adherence</span>
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] font-semibold text-nexus-text-secondary uppercase">
              <th className="p-4">Playbook / SOP Name</th>
              <th className="p-4">With SOP (Adhered)</th>
              <th className="p-4">Without SOP (Non-User)</th>
              <th className="p-4">Impact Lift</th>
              <th className="p-4 text-right">Monthly Revenue Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C] text-xs">
            {performanceData.map((item) => (
              <tr key={item.sopName} className="hover:bg-[#141A29]/60 transition-colors">
                <td className="p-4 font-bold text-white text-sm">{item.sopName}</td>
                <td className="p-4 font-bold text-[#10D078]">{item.usedByRepsRate}</td>
                <td className="p-4 font-semibold text-rose-400">{item.unusedByRepsRate}</td>
                <td className="p-4">
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                    {item.impactBoost}
                  </span>
                </td>
                <td className="p-4 text-right font-bold text-white text-sm">{item.revenueGenerated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
