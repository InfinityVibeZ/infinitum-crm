"use client";

import { IconTemplate } from "@tabler/icons-react";

export default function DocumentTemplatesPage() {
  const templates = [
    { id: "1", name: "Standard Consulting Retainer Proposal", category: "Proposals", type: "PDF Template" },
    { id: "2", name: "Master Services Agreement (MSA)", category: "Legal Contracts", type: "DocuSign Template" },
    { id: "3", name: "30-Day Onboarding Welcome Brief", category: "Client Onboarding", type: "PDF Template" },
  ];

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconTemplate size={24} />
          </span>
          Document Templates
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Reusable templates for proposals, MSAs, SOWs, and invoice layouts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="bg-nexus-card border border-nexus-border rounded-xl p-5 hover:border-nexus-primary/40 transition-colors">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {t.category}
            </span>
            <h3 className="font-bold text-sm text-nexus-text mt-2">{t.name}</h3>
            <span className="text-xs text-nexus-muted mt-2 block">{t.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
