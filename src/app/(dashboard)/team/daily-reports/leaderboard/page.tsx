"use client";

import { IconTrophy, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function DailyLeaderboardPage() {
  const dailyLeaderboard = [
    { rank: "🥇", name: "John Doe", calls: 47, bookings: 5, status: "TOP_PERFORMER" },
    { rank: "🥈", name: "Sarah Connor", calls: 42, bookings: 4, status: "HIGH_PACE" },
    { rank: "🥉", name: "Maria Garcia", calls: 38, bookings: 3, status: "ON_TRACK" },
    { rank: "⚠️", name: "Tim Drake", calls: 15, bookings: 1, status: "NEEDS_ATTENTION" },
  ];

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
            <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <IconTrophy size={24} />
            </span>
            Daily Performance Leaderboard
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            Real-time daily activity ranking and call volume competition.
          </p>
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] font-semibold text-nexus-text-secondary uppercase">
              <th className="p-4">Rank</th>
              <th className="p-4">Rep Name</th>
              <th className="p-4">Outreach / Calls</th>
              <th className="p-4">Bookings</th>
              <th className="p-4">Status Pace</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C] text-xs">
            {dailyLeaderboard.map((item) => (
              <tr key={item.name} className="hover:bg-[#141A29]/60 transition-colors">
                <td className="p-4 text-base font-bold">{item.rank}</td>
                <td className="p-4 font-bold text-white text-sm">{item.name}</td>
                <td className="p-4 font-bold text-[#38BDF8] text-sm">{item.calls}</td>
                <td className="p-4 font-bold text-[#10D078] text-sm">{item.bookings}</td>
                <td className="p-4">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      item.status === "TOP_PERFORMER"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : item.status === "HIGH_PACE"
                        ? "bg-[#10D078]/10 text-[#10D078] border-[#10D078]/20"
                        : item.status === "ON_TRACK"
                        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
