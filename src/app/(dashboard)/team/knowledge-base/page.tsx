"use client";

import { useState } from "react";
import { IconBook, IconSearch, IconChartBar, IconStar, IconSparkles } from "@tabler/icons-react";
import Link from "next/link";

export default function KnowledgeBaseMainPage() {
  const [search, setSearch] = useState("");

  const articles = [
    { id: "1", title: "Outbound Cold Calling & Permission Openers", category: "Outreach SOP", updated: "3 days ago", rating: "4.9/5", views: 412, closeImpact: "+90% close rate boost" },
    { id: "2", title: "Master Objection Handling (No Budget, Competitor)", category: "Sales Playbook", updated: "1 week ago", rating: "4.8/5", views: 342, closeImpact: "+75% objection recovery" },
    { id: "3", title: "15-Minute Discovery Call Qualification Structure", category: "Discovery SOP", updated: "2 weeks ago", rating: "4.7/5", views: 289, closeImpact: "+82% qualification pace" },
    { id: "4", title: "Closing Framework & Deposit Collection", category: "Closing Playbook", updated: "1 month ago", rating: "4.9/5", views: 512, closeImpact: "+110% upfront cash in" },
  ];

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconBook size={24} />
            </span>
            Knowledge Base & SOPs
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-1">
            Centralized repository for sales playbooks, scripts, onboarding guidelines, and performance metrics.
          </p>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2">
          <Link
            href="/team/knowledge-base/performance"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg transition-colors text-[#10D078]"
          >
            <IconChartBar size={16} />
            <span>SOP Performance</span>
          </Link>

          <Link
            href="/team/knowledge-base/ratings"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg transition-colors text-amber-400"
          >
            <IconStar size={16} />
            <span>Quality Ratings</span>
          </Link>

          <Link
            href="/team/knowledge-base/recommendations"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg transition-colors text-[#38BDF8]"
          >
            <IconSparkles size={16} />
            <span>AI Suggestions</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex items-center gap-3">
        <IconSearch size={18} className="text-nexus-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search knowledge base articles, objection handling scripts, SOPs..."
          className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white placeholder:text-nexus-muted focus:outline-none focus:border-[#10D078]"
        />
      </div>

      {/* Grid of SOP Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles
          .filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
          .map((art) => (
            <div
              key={art.id}
              className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 hover:border-[#10D078]/40 transition-all shadow-sm space-y-3"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                  {art.category}
                </span>
                <span className="text-xs font-bold text-amber-400">⭐ {art.rating}</span>
              </div>

              <h3 className="font-bold text-base text-white">{art.title}</h3>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#151B2C]">
                <span className="text-[#10D078] font-semibold">{art.closeImpact}</span>
                <span className="text-nexus-muted">{art.views} views • {art.updated}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
