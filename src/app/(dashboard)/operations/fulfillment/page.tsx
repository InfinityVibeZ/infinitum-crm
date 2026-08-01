"use client";

import { useState } from "react";
import { IconCheckbox, IconCheck } from "@tabler/icons-react";

export default function ProjectManagementFulfillmentPage() {
  const [projects] = useState([
    { id: "PRJ-101", client: "ABC Corp Systems", service: "AIGC Systems", sprint: "Sprint 2: Lead Scraper", status: "ACTIVE" },
    { id: "PRJ-102", client: "Lmnopq, Corp.", service: "Ongoing Support", sprint: "Sprint 1: Onboarding", status: "ONBOARDING" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconCheckbox size={24} />
          </span>
          Project Management & Fulfillment
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Service delivery tracking, active client sprints, and milestone fulfillment.
        </p>
      </div>

      <div className="space-y-4">
        {projects.map((p) => (
          <div key={p.id} className="bg-nexus-card border border-nexus-border rounded-xl p-5 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-nexus-text">{p.client}</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {p.service}
              </span>
            </div>
            <p className="text-xs text-nexus-muted">Current Sprint: <strong className="text-nexus-text">{p.sprint}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
}
