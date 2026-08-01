"use client";

import { IconTarget, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function PipelineForecastPage() {
  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div className="flex items-center gap-3">
        <Link
          href="/team/sales-team-reports"
          className="p-2 bg-[#0B0F19] border border-[#151B2C] rounded-lg text-nexus-muted hover:text-white transition-colors"
        >
          <IconArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconTarget size={24} />
            </span>
            Sales Pipeline 30-Day Forecast
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            Predictive revenue forecast based on stage probabilities, historical close speed, and team quota goals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Active Pipeline</span>
          <div className="text-2xl font-bold mt-1 text-white">₹450,000.00</div>
          <span className="text-[11px] text-nexus-muted mt-1 block">Total unweighted value</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Projected Close (30 Days)</span>
          <div className="text-2xl font-bold mt-1 text-[#10D078]">₹185,000.00</div>
          <span className="text-[11px] text-[#10D078] mt-1 block">Probability adjusted</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Monthly Quota Goal</span>
          <div className="text-2xl font-bold mt-1 text-sky-400">₹200,000.00</div>
          <span className="text-[11px] text-sky-400 mt-1 block">Team target</span>
        </div>

        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Quota Target Gap</span>
          <div className="text-2xl font-bold mt-1 text-amber-400">-₹15,000.00</div>
          <span className="text-[11px] text-amber-400 mt-1 block">93% pace achieved</span>
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-white">Probability Breakdown by Stage</h3>

        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-white font-semibold">Contract Signed / Kickoff (90-100% prob)</span>
              <span className="font-bold text-[#10D078]">₹75,000.00</span>
            </div>
            <div className="w-full bg-[#06080F] h-2 rounded-full overflow-hidden border border-[#151B2C]">
              <div className="bg-[#10D078] h-full w-[80%]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-white font-semibold">Contract Sent / Negotiation (70-80% prob)</span>
              <span className="font-bold text-sky-400">₹60,000.00</span>
            </div>
            <div className="w-full bg-[#06080F] h-2 rounded-full overflow-hidden border border-[#151B2C]">
              <div className="bg-sky-400 h-full w-[65%]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-white font-semibold">Proposal Sent / Discovery (30-50% prob)</span>
              <span className="font-bold text-purple-400">₹50,000.00</span>
            </div>
            <div className="w-full bg-[#06080F] h-2 rounded-full overflow-hidden border border-[#151B2C]">
              <div className="bg-purple-400 h-full w-[50%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
