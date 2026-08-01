"use client";

import { useState } from "react";
import { IconUserPlus, IconCheck } from "@tabler/icons-react";

export default function OperationsOnboardingPage() {
  const [onboardings] = useState([
    { id: "1", client: "ABC Corp Systems", package: "Full Lead Engine Deployment", progress: 75, status: "IN_PROGRESS" },
    { id: "2", client: "XYZ Inc", package: "Consulting Package", progress: 100, status: "COMPLETED" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconUserPlus size={24} />
          </span>
          Client & Team Onboarding Operations
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Automated onboarding workflows, kick-off checklists, and integration handoffs.
        </p>
      </div>

      <div className="space-y-4">
        {onboardings.map((o) => (
          <div key={o.id} className="bg-nexus-card border border-nexus-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-nexus-text">{o.client}</h3>
                <span className="text-xs text-nexus-muted">{o.package}</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {o.status}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Progress</span>
                <span className="font-bold text-nexus-primary">{o.progress}%</span>
              </div>
              <div className="w-full bg-nexus-bg h-2 rounded-full overflow-hidden border border-nexus-border">
                <div className="bg-nexus-primary h-full transition-all duration-300" style={{ width: `${o.progress}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
