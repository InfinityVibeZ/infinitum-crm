"use client";

import { IconUserCheck, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function RepPerformanceCardsPage() {
  const reps = [
    {
      name: "Zawad Uzzaman",
      role: "Closer",
      revenue: "₹85,000",
      quotaPace: "125%",
      pipeline: "₹140,000",
      conversionRate: "28.5%",
      winRate: "32.0%",
      activityScore: 94,
    },
    {
      name: "Sarah Connor",
      role: "Closer",
      revenue: "₹72,000",
      quotaPace: "108%",
      pipeline: "₹95,000",
      conversionRate: "24.0%",
      winRate: "27.5%",
      activityScore: 88,
    },
    {
      name: "Tim Drake",
      role: "Setter",
      revenue: "₹42,000",
      quotaPace: "62%",
      pipeline: "₹35,000",
      conversionRate: "14.2%",
      winRate: "18.0%",
      activityScore: 65,
    },
  ];

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
            <span className="p-2 bg-[#38BDF8]/10 rounded-xl text-[#38BDF8]">
              <IconUserCheck size={24} />
            </span>
            Sales Rep Performance Cards
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            Complete individual snapshot per rep: Revenue, Quota %, Pipeline, Conversion, Win Rate & Activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reps.map((rep) => (
          <div
            key={rep.name}
            className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 shadow-sm space-y-4 hover:border-[#10D078]/40 transition-colors"
          >
            <div className="flex justify-between items-start pb-3 border-b border-[#151B2C]">
              <div>
                <h3 className="font-bold text-base text-white">{rep.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                  {rep.role}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-nexus-muted block">Quota Pace</span>
                <span
                  className={`font-bold text-sm ${
                    parseInt(rep.quotaPace) >= 100 ? "text-[#10D078]" : "text-rose-400"
                  }`}
                >
                  {rep.quotaPace}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#06080F] p-2.5 rounded-lg border border-[#151B2C]">
                <span className="text-nexus-muted block">Revenue Closed</span>
                <span className="font-bold text-white text-sm">{rep.revenue}</span>
              </div>

              <div className="bg-[#06080F] p-2.5 rounded-lg border border-[#151B2C]">
                <span className="text-nexus-muted block">Pipeline Managed</span>
                <span className="font-bold text-[#38BDF8] text-sm">{rep.pipeline}</span>
              </div>

              <div className="bg-[#06080F] p-2.5 rounded-lg border border-[#151B2C]">
                <span className="text-nexus-muted block">Conversion Rate</span>
                <span className="font-bold text-teal-400 text-sm">{rep.conversionRate}</span>
              </div>

              <div className="bg-[#06080F] p-2.5 rounded-lg border border-[#151B2C]">
                <span className="text-nexus-muted block">Win Rate</span>
                <span className="font-bold text-amber-400 text-sm">{rep.winRate}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-nexus-muted font-semibold">Activity Score</span>
                <span className="font-bold text-[#10D078]">{rep.activityScore} / 100</span>
              </div>
              <div className="w-full bg-[#06080F] h-2 rounded-full overflow-hidden border border-[#151B2C]">
                <div
                  className="bg-[#10D078] h-full rounded-full transition-all duration-300"
                  style={{ width: `${rep.activityScore}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
