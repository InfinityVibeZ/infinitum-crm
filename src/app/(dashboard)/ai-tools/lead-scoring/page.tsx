"use client";

import { IconTarget, IconSparkles } from "@tabler/icons-react";

export default function LeadScoringPage() {
  const HighScoreLeads = [
    { name: "Zawad Uzzaman", score: 94, intent: "HIGH_BUYING_INTENT", reason: "Opened 4 emails, visited pricing page twice, requested booking" },
    { name: "Mani Kanasani", score: 88, intent: "HIGH_BUYING_INTENT", reason: "Completed 3 milestone checklist items" },
  ];

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconTarget size={24} />
          </span>
          AI Predictive Lead Scoring
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Predictive AI scoring model ranking lead buying intent and conversion probability.
        </p>
      </div>

      <div className="space-y-3">
        {HighScoreLeads.map((item) => (
          <div key={item.name} className="bg-nexus-card border border-nexus-border rounded-xl p-4 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-sm text-nexus-text">{item.name}</h4>
              <p className="text-xs text-nexus-muted mt-0.5">{item.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                {item.score} / 100
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
