"use client";

import { useState } from "react";
import { IconMail, IconSparkles, IconSend } from "@tabler/icons-react";

export default function EmailAssistantPage() {
  const [prompt, setPrompt] = useState("Draft a friendly follow-up email after an initial discovery call.");
  const [response, setResponse] = useState(
    "Hi {FirstName},\n\nGreat speaking with you today! As discussed, I am attaching the overview of how our automated lead engine integrates with your CRM.\n\nLet me know if Tuesday at 2 PM works for a quick 10-minute walkthrough.\n\nBest,\n[Your Name]"
  );

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconMail size={24} />
          </span>
          AI Email Assistant
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Draft, polish, and optimize email responses with AI assistance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-nexus-card border border-nexus-border rounded-xl p-5 space-y-4">
          <label className="block text-xs font-semibold text-nexus-muted mb-1">
            Email Prompt / Instructions
          </label>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-nexus-bg border border-nexus-border rounded-lg p-3 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
          />
          <button
            onClick={() => setResponse(`Hi {FirstName},\n\nFollowing up as requested on ${prompt}...`)}
            className="w-full py-2.5 bg-nexus-primary hover:bg-nexus-primary/90 text-nexus-bg font-bold rounded-lg text-sm flex items-center justify-center gap-2"
          >
            <IconSparkles size={18} />
            Generate Draft
          </button>
        </div>

        <div className="lg:col-span-7 bg-nexus-card border border-nexus-border rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
            Generated Email Draft
          </h3>
          <div className="bg-nexus-bg border border-nexus-border rounded-lg p-4 text-sm text-nexus-text font-mono whitespace-pre-wrap">
            {response}
          </div>
        </div>
      </div>
    </div>
  );
}
