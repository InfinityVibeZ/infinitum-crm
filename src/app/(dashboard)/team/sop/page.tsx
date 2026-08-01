"use client";

import { useState } from "react";
import {
  IconBook,
  IconSearch,
} from "@tabler/icons-react";

export default function SOPLibraryPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const sops = [
    {
      id: "1",
      category: "Cold Outreach",
      title: "Outbound SDR Cold Calling Script & Intro Hook",
      updated: "Updated 3 days ago",
      content:
        "1. Permission Opener: 'Hey {FirstName}, I know I caught you completely unannounced — do you have 30 seconds for me to tell you why I called, and if it's irrelevant you can hang up on me?'\n2. Context: 'We deploy custom AI sales engines for B2B tech founders.'\n3. Problem Statement: 'Most founders we speak with are burning 20+ hours a week manually trying to source quality leads.'\n4. Low-friction Call To Action: 'Would you be opposed to taking a peek at a 2-min Loom breakdown?'",
    },
    {
      id: "2",
      category: "Objection Handling",
      title: "Master Objection Framework (No Budget, Send Email, Using Competitor)",
      updated: "Updated 1 week ago",
      content:
        "• 'Send me an email': 'Happy to do that {FirstName}. So I don't send a generic blast, what specific metric is your sales team focused on improving this quarter?'\n• 'We already have a solution': 'That makes sense. We actually integrate alongside existing setups to fill the gaps — when was the last time you audited your response rates?'\n• 'No Budget': 'Completely understand. We typically only partner when the ROI is 4x the investment in 60 days. Would it hurt to see the math?'",
    },
    {
      id: "3",
      category: "Discovery Call",
      title: "15-Minute Qualification Call Structure",
      updated: "Updated 2 weeks ago",
      content:
        "• 0-2 min: Agenda setting & rapport\n• 2-8 min: Current process & pain extraction (What is your current monthly revenue? What is your customer acquisition cost?)\n• 8-12 min: Desired state & gap analysis (If you could fix one thing in your sales process tomorrow, what would it be?)\n• 12-15 min: Transition & next steps commitment to formal demo/proposal.",
    },
    {
      id: "4",
      category: "Closing Playbook",
      title: "The 2-Call Close & Contract Signing SOP",
      updated: "Updated 1 month ago",
      content:
        "1. Recap pain extracted from Discovery Call.\n2. Present tailored proposal scope and line-item investment.\n3. Isolate decision criteria: 'Aside from the investment, is there any reason we shouldn't get started on implementation this Monday?'\n4. Issue contract link live on call & collect deposit signature.",
    },
  ];

  const filteredSOPs = sops.filter((sop) => {
    const matchesSearch =
      sop.title.toLowerCase().includes(search.toLowerCase()) ||
      sop.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || sop.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 text-nexus-text">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconBook size={24} />
          </span>
          Sales SOP Knowledge Library
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Standard Operating Procedures, cold calling playbooks, discovery frameworks, and objection handling matrices.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <IconSearch
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playbooks, objections, call scripts..."
            className="w-full bg-nexus-bg border border-nexus-border rounded-xl pl-10 pr-4 py-2 text-sm text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-nexus-bg border border-nexus-border rounded-xl px-3 py-2 text-xs font-semibold text-nexus-text focus:outline-none focus:border-nexus-primary/50"
          >
            <option value="ALL">All Categories</option>
            <option value="Cold Outreach">Cold Outreach</option>
            <option value="Objection Handling">Objection Handling</option>
            <option value="Discovery Call">Discovery Call</option>
            <option value="Closing Playbook">Closing Playbook</option>
          </select>
        </div>
      </div>

      {/* SOP Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredSOPs.map((sop) => (
          <div
            key={sop.id}
            className="bg-nexus-card border border-nexus-border rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-nexus-primary/40 transition-colors"
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-nexus-primary/10 text-nexus-primary border border-nexus-primary/20">
                  {sop.category}
                </span>
                <span className="text-[11px] text-nexus-muted">{sop.updated}</span>
              </div>

              <h3 className="text-base font-bold text-nexus-text mb-3">{sop.title}</h3>

              <div className="bg-nexus-bg border border-nexus-border rounded-xl p-4 text-xs font-mono text-nexus-text-secondary leading-relaxed whitespace-pre-wrap">
                {sop.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
