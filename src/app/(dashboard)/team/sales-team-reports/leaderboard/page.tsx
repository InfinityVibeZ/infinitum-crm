"use client";

import { IconTrophy, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function RepLeaderboardPage() {
  const leaderboard = [
    { rank: "🥇", name: "Zawad Uzzaman", revenue: "₹85,000", quotaAttainment: "125%", dealsWon: 6 },
    { rank: "🥈", name: "Sarah Connor", revenue: "₹72,000", quotaAttainment: "108%", dealsWon: 5 },
    { rank: "⚠️", name: "Tim Drake", revenue: "₹42,000", quotaAttainment: "62%", dealsWon: 3 },
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
            <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <IconTrophy size={24} />
            </span>
            Sales Rep Leaderboard & Rankings
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            Transparent team rankings, revenue closed, and quota attainment motivation leaderboard.
          </p>
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] font-semibold text-nexus-text-secondary uppercase">
              <th className="p-4">Rank</th>
              <th className="p-4">Sales Rep</th>
              <th className="p-4">Closed Revenue</th>
              <th className="p-4">Quota Attainment</th>
              <th className="p-4">Deals Won</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C] text-xs">
            {leaderboard.map((item) => (
              <tr key={item.name} className="hover:bg-[#141A29]/60 transition-colors">
                <td className="p-4 text-base font-bold">{item.rank}</td>
                <td className="p-4 font-bold text-white text-sm">{item.name}</td>
                <td className="p-4 font-bold text-[#10D078] text-sm">{item.revenue}</td>
                <td className="p-4">
                  <span
                    className={`font-bold text-sm ${
                      parseInt(item.quotaAttainment) >= 100 ? "text-[#10D078]" : "text-rose-400"
                    }`}
                  >
                    {item.quotaAttainment}
                  </span>
                </td>
                <td className="p-4 font-semibold text-sky-400 text-sm">{item.dealsWon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
