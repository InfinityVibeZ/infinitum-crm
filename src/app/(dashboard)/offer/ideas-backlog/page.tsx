"use client";

import { useState } from "react";
import {
  IconBulb,
  IconPlus,
  IconSearch,
  IconEye,
  IconEdit,
  IconTrash,
  IconClock,
  IconFlame,
} from "@tabler/icons-react";
import { IdeaModal } from "@/components/offer/idea-modal";
import { IdeaDetailsModal } from "@/components/offer/idea-details-modal";

const INITIAL_IDEAS = [
  {
    id: "idea-1",
    title: "Automated Loom Video Personalization Engine",
    category: "Feature",
    submitter: "Sarah Chen",
    status: "IN_VALIDATION",
    impact: "HIGH",
    effort: "MEDIUM",
    revenuePotential: 50000,
    progressPercent: 60,
    nextMilestone: "User testing & beta scripts (5 days)",
    description: "Auto-generate personalized video script thumbnails for cold prospects using AI template variables.",
    problemStatement: "Manual cold outreach video creation takes 25 minutes per prospect.",
    proposedSolution: "Integrate automated AI video renderer API to generate 100 videos per hour.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "idea-2",
    title: "Enterprise Retainer Growth Tier (₹15K/mo)",
    category: "Offer Tier",
    submitter: "Zawad Uzzaman",
    status: "APPROVED",
    impact: "HIGH",
    effort: "HIGH",
    revenuePotential: 90000,
    progressPercent: 75,
    nextMilestone: "Contract terms review with legal",
    description: "New enterprise offer bundle including 24/7 dedicated SDR ops, custom CRM integrations, and bi-weekly growth strategy.",
    problemStatement: "Enterprise clients request broader scope than current Standard package offers.",
    proposedSolution: "Productize high-touch Enterprise tier at ₹1,20,000 / month.",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "idea-3",
    title: "Clay & Apollo Data Scraping Webhook Pipeline",
    category: "Integration",
    submitter: "Maria Santos",
    status: "BUILDING",
    impact: "HIGH",
    effort: "LOW",
    revenuePotential: 35000,
    progressPercent: 85,
    nextMilestone: "Deploy webhook listener to production",
    description: "Automatic lead enrichment pipeline pulling verified work emails and phone numbers instantly on lead capture.",
    problemStatement: "Lead enrichment delays manual outreach by up to 24 hours.",
    proposedSolution: "Build instant webhook connector fetching verified contact data under 5 seconds.",
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: "idea-4",
    title: "AI Email Assistant Auto-Responder Bot",
    category: "Campaign",
    submitter: "John Doe",
    status: "LAUNCHED",
    impact: "MEDIUM",
    effort: "MEDIUM",
    revenuePotential: 25000,
    progressPercent: 100,
    nextMilestone: "Feature launched & live in production 🎉",
    description: "AI assistant that drafts personalized follow-up emails for interested prospects who open proposals.",
    problemStatement: "Follow-up speed lags when close team is busy.",
    proposedSolution: "Auto-draft response in Next.js backend for closer 1-click approval.",
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];

export default function IdeasBacklogPage() {
  const [ideas, setIdeas] = useState<any[]>(INITIAL_IDEAS);

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [impactFilter, setImpactFilter] = useState("ALL");
  const [effortFilter, setEffortFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<any>(null);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingIdea, setViewingIdea] = useState<any>(null);

  const handleSaveIdea = (savedIdea: any) => {
    const exists = ideas.find((i) => i.id === savedIdea.id);
    if (exists) {
      setIdeas(ideas.map((i) => (i.id === savedIdea.id ? savedIdea : i)));
    } else {
      setIdeas([savedIdea, ...ideas]);
    }
  };


  // Filter & Sort Logic
  const filteredIdeas = ideas.filter((idea) => {
    const matchesSearch =
      idea.title.toLowerCase().includes(search.toLowerCase()) ||
      idea.description.toLowerCase().includes(search.toLowerCase()) ||
      idea.submitter.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || idea.status === statusFilter;
    const matchesImpact = impactFilter === "ALL" || idea.impact === impactFilter;
    const matchesEffort = effortFilter === "ALL" || idea.effort === effortFilter;
    const matchesCategory = categoryFilter === "ALL" || idea.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesImpact && matchesEffort && matchesCategory;
  });

  const sortedIdeas = [...filteredIdeas].sort((a, b) => {
    if (sortBy === "IMPACT_HIGH") {
      const impWeight: any = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (impWeight[b.impact] || 0) - (impWeight[a.impact] || 0);
    }
    if (sortBy === "EFFORT_LOW") {
      const effWeight: any = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      return (effWeight[a.effort] || 0) - (effWeight[b.effort] || 0);
    }
    if (sortBy === "REVENUE_HIGH") {
      return (parseFloat(b.revenuePotential) || 0) - (parseFloat(a.revenuePotential) || 0);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-6 text-nexus-text font-sans pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <IconBulb size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Offer Ideas Backlog & Innovation Suite
            </h1>
            <p className="text-xs text-nexus-text-secondary">
              Prioritize growth experiments, evaluate financial ROI, and track ideas from submission to production release.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingIdea(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg transition-all shadow-lg shadow-[#10D078]/20 self-start md:self-auto text-xs"
        >
          <IconPlus size={16} />
          <span>Submit New Idea</span>
        </button>
      </div>

      {/* 🔍 SEARCH, FILTERS & SORTING CONTROLS */}
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search idea title, submitter, problem statement..."
            className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-nexus-muted focus:outline-none focus:border-[#10D078]"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="IN_VALIDATION">In Validation</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="BUILDING">Building</option>
            <option value="LAUNCHED">Launched 🎉</option>
          </select>

          {/* Impact Filter */}
          <select
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Impacts</option>
            <option value="HIGH">High Impact (+₹50K+)</option>
            <option value="MEDIUM">Medium Impact</option>
            <option value="LOW">Low Impact</option>
          </select>

          {/* Effort Filter */}
          <select
            value={effortFilter}
            onChange={(e) => setEffortFilter(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Efforts</option>
            <option value="LOW">Low Effort (1-2w)</option>
            <option value="MEDIUM">Medium Effort (2-3w)</option>
            <option value="HIGH">High Effort (1m+)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Categories</option>
            <option value="Feature">Feature</option>
            <option value="Offer Tier">Offer Tier</option>
            <option value="Integration">Integration</option>
            <option value="Process">Process</option>
            <option value="Campaign">Campaign</option>
          </select>

          {/* Sorting */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="NEWEST">Sort: Newest First</option>
            <option value="IMPACT_HIGH">Sort: Highest Impact</option>
            <option value="EFFORT_LOW">Sort: Lowest Effort</option>
            <option value="REVENUE_HIGH">Sort: Revenue Upside</option>
          </select>
        </div>
      </div>

      {/* RESULTS COUNTER & SUMMARY */}
      <div className="flex justify-between items-center text-xs text-nexus-muted">
        <div>
          Showing <strong className="text-white">{sortedIdeas.length}</strong> of {ideas.length} backlog ideas
        </div>
        <span className="text-[11px] text-[#10D078]">⚡ Auto-prioritized by ROI score</span>
      </div>

      {/* 📋 EXPANDED IDEA CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedIdeas.map((idea) => {
          const revVal = parseFloat(idea.revenuePotential?.toString() || "50000");

          return (
            <div
              key={idea.id}
              className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 shadow-sm space-y-4 hover:border-[#10D078]/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header Row: Title & Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      💡 {idea.category || "Feature"}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {idea.status || "IN_VALIDATION"}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-white">{idea.title}</h3>
                  <span className="text-[11px] text-nexus-muted block mt-0.5">
                    Submitted by <strong className="text-nexus-text">{idea.submitter || "Sarah Chen"}</strong> •{" "}
                    {new Date(idea.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Description Summary */}
                <p className="text-xs text-nexus-text leading-relaxed">
                  {idea.description}
                </p>

                {/* Metrics Badges Row (Impact & Effort) */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  <span className="px-2.5 py-1 rounded bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20 flex items-center gap-1">
                    <IconFlame size={12} /> Impact: {idea.impact || "HIGH"} (+₹{revVal.toLocaleString()}/mo)
                  </span>

                  <span className="px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                    <IconClock size={12} /> Effort: {idea.effort || "MEDIUM"} (2-3 wks)
                  </span>

                  <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    High ROI Score
                  </span>
                </div>

                {/* Progress Bar & Next Step Indicator */}
                <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-nexus-muted text-[11px]">Lifecycle Progress</span>
                    <span className="font-bold text-[#10D078] text-[11px]">{idea.progressPercent || 60}% Complete</span>
                  </div>
                  <div className="w-full bg-[#151B2C] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-[#10D078] h-full rounded-full"
                      style={{ width: `${idea.progressPercent || 60}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-nexus-muted block">
                    <strong className="text-white">Next Milestone:</strong> {idea.nextMilestone || "Validation & User Feedback"}
                  </span>
                </div>
              </div>

              {/* Card Footer: Quick Actions */}
              <div className="pt-3 border-t border-[#151B2C] flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setViewingIdea(idea);
                    setIsDetailsOpen(true);
                  }}
                  className="flex-1 py-1.5 bg-[#06080F] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg text-white flex items-center justify-center gap-1"
                >
                  <IconEye size={14} />
                  <span>View Details</span>
                </button>

                <button
                  onClick={() => {
                    setEditingIdea(idea);
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 text-nexus-muted hover:text-white hover:bg-[#141A29] rounded-lg transition-colors"
                  title="Edit Idea"
                >
                  <IconEdit size={16} />
                </button>


              </div>
            </div>
          );
        })}
      </div>

      {/* Idea Form Modal */}
      <IdeaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ideaData={editingIdea}
        onSave={handleSaveIdea}
      />

      {/* Idea Details Modal */}
      <IdeaDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        idea={viewingIdea}
      />
    </div>
  );
}
