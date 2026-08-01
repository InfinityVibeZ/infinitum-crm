"use client";

import { useState } from "react";
import {
  IconRobot,
  IconCopy,
  IconCheck,
  IconSparkles,
  IconSend,
  IconBrandLinkedin,
  IconMail,
} from "@tabler/icons-react";

export default function AIContentCompanionPage() {
  const [channel, setChannel] = useState<"email" | "linkedin" | "followup">("email");
  const [tone, setTone] = useState("Consultative Value-First");
  const [targetRole, setTargetRole] = useState("VP of Sales / Agency Founder");
  const [offerFocus, setOfferFocus] = useState("AIGC Systems & Lead Engine Setup");
  const [prospectCompany, setProspectCompany] = useState("Acme Corp");
  const [copied, setCopied] = useState(false);

  const [generatedSubject, setGeneratedSubject] = useState("Quick question regarding {company}'s outbound infrastructure");
  const [generatedBody, setGeneratedBody] = useState(
    `Hi {firstName},\n\nSaw that {company} is scaling its outbound team. Most founders I speak with are getting stuck booking fewer than 10 qualified calls a month despite spending thousands on lead lists.\n\nWe recently deployed an automated AI lead engine for a similar B2B company that boosted their booked calls by 3.4x in 30 days without increasing ad spend.\n\nWould you be open to a quick 5-min video showing how we set this up for {company}?\n\nBest,\n[Your Name]`
  );

  const handleGenerate = () => {
    if (channel === "email") {
      setGeneratedSubject(`Quick question regarding ${prospectCompany || "{company}"}'s outbound infrastructure`);
      setGeneratedBody(
        `Hi {firstName},\n\nSaw that ${prospectCompany || "{company}"} is scaling its team. Most ${targetRole}s I speak with are getting stuck booking fewer than 10 qualified calls a month despite spending heavily on lead lists.\n\nWe recently deployed an automated ${offerFocus} for a similar team that boosted their booked calls by 3.4x in 30 days without increasing ad spend.\n\nWould you be open to a quick 5-minute loom showing how this applies to ${prospectCompany || "{company}"}?\n\nBest,\n[Your Name]`
      );
    } else if (channel === "linkedin") {
      setGeneratedSubject("");
      setGeneratedBody(
        `Hey {firstName} 👋\n\nNoticed your work at ${prospectCompany || "{company}"}. We've been helping ${targetRole}s streamline their client acquisition using ${offerFocus}.\n\nIf you're open to it, I'd love to drop over a 2-min breakdown of how we booked 18 calls last week. No pitch, just raw metrics.\n\nWorth a quick look?`
      );
    } else {
      setGeneratedSubject(`Following up re: ${prospectCompany || "{company}"}`);
      setGeneratedBody(
        `Hi {firstName},\n\nFollowing up on my previous message regarding ${offerFocus} for ${prospectCompany || "{company}"}.\n\nUnderstand you're super busy. Here is a 30-second case study of how we took a client from ₹15k to ₹45k/mo pipeline in 45 days.\n\nShould I send over the breakdown?`
      );
    }
  };

  const handleCopy = () => {
    const textToCopy = generatedSubject ? `Subject: ${generatedSubject}\n\n${generatedBody}` : generatedBody;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-nexus-text">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconRobot size={24} />
          </span>
          AI Content Companion
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Generate high-converting SDR cold emails, LinkedIn InMails, and follow-up copy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Panel (5 cols) */}
        <div className="lg:col-span-5 bg-nexus-card border border-nexus-border rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-nexus-text-secondary">
            Outreach Parameters
          </h3>

          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-semibold text-nexus-muted mb-1.5">
              Outreach Channel
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  channel === "email"
                    ? "bg-nexus-primary/20 border-nexus-primary text-nexus-primary"
                    : "bg-nexus-bg border-nexus-border text-nexus-text-secondary hover:bg-nexus-hover"
                }`}
              >
                <IconMail size={16} />
                Cold Email
              </button>

              <button
                type="button"
                onClick={() => setChannel("linkedin")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  channel === "linkedin"
                    ? "bg-nexus-primary/20 border-nexus-primary text-nexus-primary"
                    : "bg-nexus-bg border-nexus-border text-nexus-text-secondary hover:bg-nexus-hover"
                }`}
              >
                <IconBrandLinkedin size={16} />
                LinkedIn
              </button>

              <button
                type="button"
                onClick={() => setChannel("followup")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  channel === "followup"
                    ? "bg-nexus-primary/20 border-nexus-primary text-nexus-primary"
                    : "bg-nexus-bg border-nexus-border text-nexus-text-secondary hover:bg-nexus-hover"
                }`}
              >
                <IconSend size={16} />
                Follow-up
              </button>
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-semibold text-nexus-muted mb-1">
              Tone & Angle
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
            >
              <option value="Consultative Value-First">Consultative Value-First</option>
              <option value="Casual Conversational">Casual Conversational</option>
              <option value="Direct ROI & Metric">Direct ROI & Metric Driven</option>
              <option value="Urgency & Scarcity">Urgency & Scarcity Trigger</option>
            </select>
          </div>

          {/* Target Role */}
          <div>
            <label className="block text-xs font-semibold text-nexus-muted mb-1">
              Target Persona / Role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
            />
          </div>

          {/* Offer Focus */}
          <div>
            <label className="block text-xs font-semibold text-nexus-muted mb-1">
              Core Offer / Service Focus
            </label>
            <input
              type="text"
              value={offerFocus}
              onChange={(e) => setOfferFocus(e.target.value)}
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
            />
          </div>

          {/* Prospect Company */}
          <div>
            <label className="block text-xs font-semibold text-nexus-muted mb-1">
              Example Company Name
            </label>
            <input
              type="text"
              value={prospectCompany}
              onChange={(e) => setProspectCompany(e.target.value)}
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full py-2.5 bg-nexus-primary hover:bg-nexus-primary/90 text-nexus-bg font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-nexus-primary/10"
          >
            <IconSparkles size={18} />
            Generate Outreach Copy
          </button>
        </div>

        {/* Generated Preview Card (7 cols) */}
        <div className="lg:col-span-7 bg-nexus-card border border-nexus-border rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-nexus-border mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <IconSparkles size={16} />
                Generated Copy Output
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-nexus-hover hover:bg-nexus-border text-nexus-text transition-colors border border-nexus-border"
              >
                {copied ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} />}
                <span>{copied ? "Copied!" : "Copy Copy"}</span>
              </button>
            </div>

            {/* Subject line (if email or followup) */}
            {generatedSubject && (
              <div className="mb-4">
                <span className="block text-[11px] font-semibold text-nexus-muted mb-1">
                  Subject Line:
                </span>
                <div className="bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm font-semibold text-nexus-primary">
                  {generatedSubject}
                </div>
              </div>
            )}

            {/* Body */}
            <div>
              <span className="block text-[11px] font-semibold text-nexus-muted mb-1">
                Body Copy:
              </span>
              <div className="bg-nexus-bg border border-nexus-border rounded-lg p-4 text-sm text-nexus-text leading-relaxed whitespace-pre-wrap font-mono">
                {generatedBody}
              </div>
            </div>
          </div>

          {/* Quick Template Tag Tokens */}
          <div className="pt-4 border-t border-nexus-border mt-6">
            <span className="text-[10px] uppercase font-bold text-nexus-muted block mb-2">
              Available Personalization Variables:
            </span>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="bg-nexus-bg px-2 py-0.5 rounded border border-nexus-border text-nexus-primary font-mono">
                &#123;firstName&#125;
              </span>
              <span className="bg-nexus-bg px-2 py-0.5 rounded border border-nexus-border text-nexus-primary font-mono">
                &#123;company&#125;
              </span>
              <span className="bg-nexus-bg px-2 py-0.5 rounded border border-nexus-border text-nexus-primary font-mono">
                &#123;jobTitle&#125;
              </span>
              <span className="bg-nexus-bg px-2 py-0.5 rounded border border-nexus-border text-nexus-primary font-mono">
                &#123;revenueGoal&#125;
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
