"use client";

import { IconStar, IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function ContentQualityRatingsPage() {
  const ratings = [
    {
      title: "Closing Framework & Deposit Collection",
      rating: "4.9 / 5.0",
      views: 342,
      helpful: "89% helpful",
      status: "TOP_PERFORMER",
    },
    {
      title: "Outbound Cold Calling Openers",
      rating: "4.8 / 5.0",
      views: 412,
      helpful: "94% helpful",
      status: "TOP_PERFORMER",
    },
    {
      title: "Legacy 2024 Outreach Script",
      rating: "2.1 / 5.0",
      views: 12,
      helpful: "15% helpful",
      status: "FLAGGED_FOR_DELETION",
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
            <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <IconStar size={24} />
            </span>
            Content Quality Ratings & Reviews
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-0.5">
            5-star crowdsourced quality rating system showing high-impact playbooks and pruning outdated material.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {ratings.map((r) => (
          <div
            key={r.title}
            className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 shadow-sm flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base text-white">{r.title}</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    r.status === "TOP_PERFORMER"
                      ? "bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {r.status === "TOP_PERFORMER" ? "Recommended" : "Flagged for Deletion"}
                </span>
              </div>
              <span className="text-xs text-nexus-muted">
                {r.views} total views • {r.helpful}
              </span>
            </div>

            <div className="text-right">
              <span className="text-lg font-bold text-amber-400">⭐ {r.rating}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
