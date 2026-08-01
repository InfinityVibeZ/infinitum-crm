"use client";

import { IconX, IconBulb, IconChartBar, IconUserCheck, IconCheck } from "@tabler/icons-react";

interface IdeaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  idea: any;
}

export function IdeaDetailsModal({
  isOpen,
  onClose,
  idea,
}: IdeaDetailsModalProps) {
  if (!isOpen || !idea) return null;

  const revenueVal = parseFloat(idea.revenuePotential?.toString() || "50000");

  const workflowSteps = [
    { label: "Submitted", status: "COMPLETED" },
    { label: "Validation", status: idea.progressPercent >= 25 ? "COMPLETED" : "PENDING" },
    { label: "Review", status: idea.progressPercent >= 50 ? "COMPLETED" : "PENDING" },
    { label: "Approved", status: idea.progressPercent >= 75 ? "COMPLETED" : "PENDING" },
    { label: "Building", status: idea.progressPercent >= 90 ? "COMPLETED" : "PENDING" },
    { label: "Launched 🎉", status: idea.progressPercent >= 100 ? "COMPLETED" : "PENDING" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl w-full max-w-xl shadow-2xl p-6 text-nexus-text space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#151B2C] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                {idea.category || "Feature"}
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {idea.status || "IN_VALIDATION"}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white">{idea.title}</h2>
            <div className="text-xs text-nexus-muted mt-0.5 flex items-center gap-2">
              <span>Submitted by <strong>{idea.submitter || "Sarah Chen"}</strong></span>
              <span>•</span>
              <span>{idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : "2 days ago"}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-nexus-muted hover:text-white rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Workflow Lifecycle Progress Tracker */}
        <div>
          <h4 className="text-xs font-bold text-nexus-text-secondary uppercase tracking-wider mb-2">
            Workflow Progression ({idea.progressPercent || 60}% Complete)
          </h4>
          <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-4 space-y-2">
            <div className="grid grid-cols-6 gap-1 text-[10px] font-bold text-center">
              {workflowSteps.map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div
                    className={`h-2 rounded-full ${
                      step.status === "COMPLETED" ? "bg-[#10D078]" : "bg-[#151B2C]"
                    }`}
                  />
                  <span className={step.status === "COMPLETED" ? "text-white" : "text-nexus-muted"}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Impact & Effort Highlights Banner */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#06080F] p-3 rounded-xl border border-[#151B2C]">
            <span className="text-nexus-muted text-[10px] block font-semibold uppercase">Impact Rating</span>
            <span className="font-bold text-[#10D078] text-xs">{idea.impact || "HIGH"} Level</span>
          </div>

          <div className="bg-[#06080F] p-3 rounded-xl border border-[#151B2C]">
            <span className="text-nexus-muted text-[10px] block font-semibold uppercase">Est. Monthly Revenue</span>
            <span className="font-extrabold text-[#38BDF8] text-xs">+₹{revenueVal.toLocaleString()}/mo</span>
          </div>

          <div className="bg-[#06080F] p-3 rounded-xl border border-[#151B2C]">
            <span className="text-nexus-muted text-[10px] block font-semibold uppercase">Effort Estimate</span>
            <span className="font-bold text-amber-400 text-xs">{idea.effort || "MEDIUM"} (2-3 wks)</span>
          </div>
        </div>

        {/* Description & Detailed Breakdown */}
        <div className="space-y-3 text-xs">
          <div className="bg-[#06080F] border border-[#151B2C] p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-[#10D078] block">Summary Overview</span>
            <p className="text-white leading-relaxed">{idea.description || "No summary provided."}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#06080F] border border-[#151B2C] p-3 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-rose-400 block">Problem Addressed</span>
              <p className="text-nexus-muted">{idea.problemStatement || "Manual outbound customization takes 25 mins per prospect."}</p>
            </div>

            <div className="bg-[#06080F] border border-[#151B2C] p-3 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-sky-400 block">Proposed Solution</span>
              <p className="text-nexus-muted">{idea.proposedSolution || "Auto-generate personalized video script templates via AI API."}</p>
            </div>
          </div>
        </div>

        {/* Footer Close */}
        <div className="flex justify-end pt-2 border-t border-[#151B2C]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg text-xs"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
