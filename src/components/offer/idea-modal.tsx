"use client";

import { useState, useEffect } from "react";
import { IconX } from "@tabler/icons-react";

interface IdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideaData?: any;
  onSave: (idea: any) => void;
}

export function IdeaModal({
  isOpen,
  onClose,
  ideaData,
  onSave,
}: IdeaModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Feature");
  const [submitter, setSubmitter] = useState("Sarah Chen");
  const [status, setStatus] = useState("IN_VALIDATION");
  const [impact, setImpact] = useState("HIGH");
  const [effort, setEffort] = useState("MEDIUM");
  const [revenuePotential, setRevenuePotential] = useState("50000");
  const [description, setDescription] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [proposedSolution, setProposedSolution] = useState("");

  useEffect(() => {
    if (ideaData) {
      setTitle(ideaData.title || "");
      setCategory(ideaData.category || "Feature");
      setSubmitter(ideaData.submitter || "Sarah Chen");
      setStatus(ideaData.status || "IN_VALIDATION");
      setImpact(ideaData.impact || "HIGH");
      setEffort(ideaData.effort || "MEDIUM");
      setRevenuePotential(ideaData.revenuePotential ? ideaData.revenuePotential.toString() : "50000");
      setDescription(ideaData.description || "");
      setProblemStatement(ideaData.problemStatement || "");
      setProposedSolution(ideaData.proposedSolution || "");
    } else {
      setTitle("");
      setCategory("Feature");
      setSubmitter("Zawad Uzzaman");
      setStatus("SUBMITTED");
      setImpact("HIGH");
      setEffort("MEDIUM");
      setRevenuePotential("50000");
      setDescription("");
      setProblemStatement("");
      setProposedSolution("");
    }
  }, [ideaData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newIdea = {
      id: ideaData?.id || `idea-${Date.now()}`,
      title,
      category,
      submitter,
      status,
      impact,
      effort,
      revenuePotential: parseFloat(revenuePotential) || 50000,
      description,
      problemStatement,
      proposedSolution,
      progressPercent: ideaData?.progressPercent || (status === "LAUNCHED" ? 100 : status === "BUILDING" ? 75 : status === "APPROVED" ? 50 : 25),
      createdAt: ideaData?.createdAt || new Date().toISOString(),
    };

    onSave(newIdea);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl w-full max-w-lg shadow-2xl p-6 text-nexus-text space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-[#151B2C]">
          <h2 className="text-lg font-bold text-white">
            {ideaData ? "Edit Idea Backlog Entry" : "Submit New Offer Idea"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-nexus-muted hover:text-white rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-nexus-muted mb-1">Idea Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Automated Video Prospecting Personalization"
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="Feature">Feature</option>
                <option value="Offer Tier">Offer Tier</option>
                <option value="Integration">Integration</option>
                <option value="Process">Process</option>
                <option value="Campaign">Campaign</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Submitter</label>
              <input
                type="text"
                required
                value={submitter}
                onChange={(e) => setSubmitter(e.target.value)}
                placeholder="Submitter Name"
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>

            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Workflow Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_VALIDATION">In Validation</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="APPROVED">Approved</option>
                <option value="BUILDING">Building</option>
                <option value="LAUNCHED">Launched 🎉</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Impact Level</label>
              <select
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="HIGH">High (+₹50K+)</option>
                <option value="MEDIUM">Medium (+₹20K)</option>
                <option value="LOW">Low (+₹5K)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Effort Level</label>
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="LOW">Low (1-2 wks)</option>
                <option value="MEDIUM">Medium (2-3 wks)</option>
                <option value="HIGH">High (1 mo+)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Est. Revenue (₹/mo)</label>
              <input
                type="number"
                value={revenuePotential}
                onChange={(e) => setRevenuePotential(e.target.value)}
                placeholder="50000"
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-nexus-muted mb-1">Description Summary</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of what this idea proposes..."
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Problem Statement</label>
              <textarea
                rows={2}
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="Current pain point..."
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2 text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>
            <div>
              <label className="block font-semibold text-nexus-muted mb-1">Proposed Solution</label>
              <textarea
                rows={2}
                value={proposedSolution}
                onChange={(e) => setProposedSolution(e.target.value)}
                placeholder="Expected solution..."
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2 text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#151B2C]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#06080F] border border-[#151B2C] rounded-lg text-nexus-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg shadow-lg shadow-[#10D078]/20"
            >
              {ideaData ? "Update Idea" : "Submit Idea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
