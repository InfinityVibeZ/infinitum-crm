"use client";

import { IconSparkles, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function SmartRecommendationsPage() {
  const recommendations = [
    {
      context: "Hot Lead Negotiating Contract",
      recommendation: "Closing Framework & Deposit Collection",
      reason: "Lead requested pricing details. Closing SOP boosts conversion by +110%.",
    },
    {
      context: "Objection: Competitor Pricing",
      recommendation: "Master Objection Handling Script (Page 4)",
      reason: "Lead mentioned lower offer from competitor. Use value anchor comparison script.",
    },
    {
      context: "New Discovery Scheduled",
      recommendation: "15-Minute Discovery Qualification Structure",
      reason: "Ensure budget, timeline, and authority are verified before proposal prep.",
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
            <span className="p-2 bg-[#38BDF8]/10 rounded-xl text-[#38BDF8]">
              <IconSparkles size={24} />
            </span>
            Recommended Knowledge & AI Content Suggestions
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            Contextual AI suggestions delivering the right playbook script automatically based on active deal stages.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec) => (
          <div
            key={rec.context}
            className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 shadow-sm space-y-2 hover:border-[#38BDF8]/40 transition-colors"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
                Context: {rec.context}
              </span>
              <span className="text-xs text-[#10D078] font-bold">Auto-Suggested</span>
            </div>

            <h3 className="font-bold text-base text-white">{rec.recommendation}</h3>
            <p className="text-xs text-nexus-muted">{rec.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
