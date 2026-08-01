"use client";

import { IconSparkles, IconArrowLeft, IconRobot } from "@tabler/icons-react";
import Link from "next/link";

export default function AIBriefingPage() {
  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div className="flex items-center gap-3">
        <Link
          href="/team/daily-reports"
          className="p-2 bg-[#0B0F19] border border-[#151B2C] rounded-lg text-nexus-muted hover:text-white transition-colors"
        >
          <IconArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconSparkles size={24} />
            </span>
            Daily Team Briefing (AI-Powered)
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            5-second AI synthesis of entire sales team daily output, roadblocks, and financial forecasts.
          </p>
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-[#10D078]/30 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 text-[#10D078] font-bold text-sm">
          <IconRobot size={22} />
          <span>Executive AI Summary</span>
        </div>

        <div className="p-4 bg-[#06080F] border border-[#151B2C] rounded-lg text-sm leading-relaxed text-white font-mono">
          &quot;Team total output today: <strong>156 calls</strong>, <strong>12 bookings</strong> | 3 active alerts (John call drop, Maria legal blocker) | 30-Day Pipeline Forecast pacing: <strong>₹48K target → ₹18K current gap</strong>.&quot;
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
          <div className="bg-[#06080F] p-4 rounded-lg border border-[#151B2C]">
            <span className="text-nexus-muted block mb-1">Key Action Item #1</span>
            <span className="text-white font-semibold">Schedule 1-on-1 coaching with John on objection handling.</span>
          </div>

          <div className="bg-[#06080F] p-4 rounded-lg border border-[#151B2C]">
            <span className="text-nexus-muted block mb-1">Key Action Item #2</span>
            <span className="text-white font-semibold">Unblock Maria&apos;s contract with legal team for Lmnopq Corp.</span>
          </div>

          <div className="bg-[#06080F] p-4 rounded-lg border border-[#151B2C]">
            <span className="text-nexus-muted block mb-1">Key Action Item #3</span>
            <span className="text-white font-semibold">Push 3 proposal prep deals into contract sent stage before EOD.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
