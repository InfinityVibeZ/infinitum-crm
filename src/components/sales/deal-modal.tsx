"use client";

import { useState, useEffect, useRef } from "react";
import { IconX, IconBriefcase, IconCalendar } from "@tabler/icons-react";

interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealData?: any;
  onSuccess: () => void;
}

export function DealModal({
  isOpen,
  onClose,
  dealData,
  onSuccess,
}: DealModalProps) {
  const [name, setName] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("NEW_OPPORTUNITY");
  const [probability, setProbability] = useState(50);
  const [serviceType, setServiceType] = useState("Consulting");
  const [customServiceType, setCustomServiceType] = useState("");
  const [leadId, setLeadId] = useState("");
  const [userId, setUserId] = useState("");
  const [dealSource, setDealSource] = useState("Facebook");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/leads").then((res) => res.json()).then(setLeads).catch(console.error);
      fetch("/api/users").then((res) => res.json()).then(setUsers).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (dealData) {
      setName(dealData.name || "");
      setValue(dealData.value ? dealData.value.toString() : "");
      setStage(dealData.stage || "NEW_OPPORTUNITY");
      setProbability(dealData.probability || 50);

      const commonServices = ["Consulting", "Software Development", "AI & Automation", "Ongoing Support", "Custom Projects", "Marketing & Lead Gen"];
      if (dealData.serviceType && !commonServices.includes(dealData.serviceType)) {
        setServiceType("Other");
        setCustomServiceType(dealData.serviceType);
      } else {
        setServiceType(dealData.serviceType || "Consulting");
        setCustomServiceType("");
      }

      setLeadId(dealData.leadId || "");
      setUserId(dealData.userId || "");
      setDealSource(dealData.dealSource || "Facebook");
      setExpectedCloseDate(
        dealData.expectedCloseDate
          ? new Date(dealData.expectedCloseDate).toISOString().split("T")[0]
          : ""
      );
      setNotes(dealData.notes || "");
    } else {
      setName("");
      setValue("");
      setStage("NEW_OPPORTUNITY");
      setProbability(50);
      setServiceType("Consulting");
      setCustomServiceType("");
      setLeadId("");
      const defaultUser = users.find((u) => u.role === "ADMIN" || u.role === "USER");
      setUserId(defaultUser?.id || "");
      setDealSource("Facebook");
      setExpectedCloseDate("");
      setNotes("");
    }
  }, [dealData, isOpen, users]);

  if (!isOpen) return null;

  const handleSelectUser = (val: string) => {
    setUserId(val);
    if (leadId) {
      const selected = leads.find((l) => l.id === leadId);
      if (selected && selected.userId !== val) {
        setLeadId("");
      }
    }
  };

  const handleSelectLead = (id: string) => {
    setLeadId(id);
    if (!id) return;
    const selected = leads.find((l) => l.id === id);
    if (selected) {
      // Auto-populate fields
      if (!name) {
        setName(`${selected.firstName} ${selected.lastName} - Deal`);
      }
      if (!value) {
        const val = selected.revenueGenerated?.toString() || selected.cashCollected?.toString() || "";
        if (val && parseFloat(val) > 0) {
          setValue(val);
        }
      }
      if (selected.probability) {
        setProbability(selected.probability);
      }
      if (selected.expectedCloseDate) {
        setExpectedCloseDate(new Date(selected.expectedCloseDate).toISOString().split("T")[0]);
      }
      if (selected.leadSource) {
        setDealSource(selected.leadSource);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return;
    setLoading(true);

    try {
      const url = dealData ? `/api/deals/${dealData.id}` : "/api/deals";
      const method = dealData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          value,
          stage,
          probability,
          serviceType: serviceType === "Other" ? customServiceType : serviceType,
          leadId: leadId || null,
          userId: userId || users.find((u) => u.role === "ADMIN" || u.role === "USER")?.id,
          dealSource,
          expectedCloseDate: expectedCloseDate || null,
          notes,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedLead = leads.find((l) => l.id === leadId);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl w-full max-w-2xl shadow-2xl p-6 text-nexus-text space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-[#151B2C]">
          <h2 className="text-lg font-bold text-white">
            {dealData ? "Edit Opportunity" : "Create New Deal"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-nexus-muted hover:text-white rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Link to Lead Card or Dropdown */}
          <div>
            <label className="block font-semibold text-nexus-muted mb-1">
              Link to Lead (Optional)
            </label>
            {selectedLead ? (
              <div className="p-3 bg-[#06080F] border border-[#151B2C] rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-xs shadow-md">
                    {(selectedLead.firstName || "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">
                      {selectedLead.firstName} {selectedLead.lastName}
                    </div>
                    <div className="text-nexus-muted text-[10px] mt-0.5">
                      {selectedLead.email || "No Email"} • {selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase text-[#10D078] px-2 py-0.5 rounded-full bg-[#10D078]/10 tracking-wider">
                    {selectedLead.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLeadId("")}
                    className="text-nexus-muted hover:text-white transition-colors p-1"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={leadId}
                onChange={(e) => handleSelectLead(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="">Select a lead...</option>
                {leads
                  .filter((l) => !userId || l.userId === userId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName} ({l.company || "No Company"})
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-nexus-muted mb-1">Deal Name *</label>
                <div className="relative">
                  <IconBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" size={16} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. ABC Corp Enterprise Plan"
                    className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-[#10D078]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-nexus-muted mb-1">Deal Value (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted font-semibold">₹</span>
                  <input
                    type="number"
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg pl-7 pr-3 py-2.5 text-white focus:outline-none focus:border-[#10D078]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-nexus-muted mb-1">
                  Close Probability (%)
                </label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={probability}
                    onChange={(e) => setProbability(Number(e.target.value))}
                    className="flex-1 accent-[#10D078]"
                  />
                  <span className={`w-8 h-3.5 rounded-sm ${
                    probability >= 70 ? "bg-emerald-500" : probability >= 35 ? "bg-amber-500" : "bg-red-500"
                  }`} />
                  <span className="text-white font-bold whitespace-nowrap">{probability}%</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-nexus-muted mb-1">Expected Close Date</label>
                <div className="relative">
                  <IconCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" size={16} />
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    onClick={() => {
                      try {
                        dateInputRef.current?.showPicker();
                      } catch (err) {
                        console.error("showPicker not supported", err);
                      }
                    }}
                    className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-[#10D078] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">


              <div>
                <label className="block font-semibold text-nexus-muted mb-1">Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
                >
                  <option value="NEW_OPPORTUNITY">New Opportunity</option>
                  <option value="DISCOVERY_SCHEDULED">Discovery Scheduled</option>
                  <option value="DISCOVERY_COMPLETED">Discovery Completed</option>
                  <option value="PROPOSAL_PREP">Proposal Prep</option>
                  <option value="PROPOSAL_SENT">Proposal Sent</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="CONTRACT_SENT">Contract Sent</option>
                  <option value="CONTRACT_SIGNED">Contract Signed</option>
                  <option value="PROJECT_KICKOFF">Project Kickoff</option>
                  <option value="ON_HOLD">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-nexus-muted mb-1">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => {
                    setServiceType(e.target.value);
                    if (e.target.value !== "Other") {
                      setCustomServiceType("");
                    }
                  }}
                  className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
                >
                  <option value="Consulting">Consulting</option>
                  <option value="Software Development">Software Development</option>
                  <option value="AI & Automation">AI & Automation</option>
                  <option value="Ongoing Support">Ongoing Support</option>
                  <option value="Custom Projects">Custom Projects</option>
                  <option value="Marketing & Lead Gen">Marketing & Lead Gen</option>
                  <option value="Other">Other</option>
                </select>
                {serviceType === "Other" && (
                  <input
                    type="text"
                    required
                    value={customServiceType}
                    onChange={(e) => setCustomServiceType(e.target.value)}
                    placeholder="Specify service type..."
                    className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 mt-2 text-white focus:outline-none focus:border-[#10D078]"
                  />
                )}
              </div>



              <div>
                <label className="block font-semibold text-nexus-muted mb-1">Weighted Value (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted font-semibold">₹</span>
                  <input
                    type="text"
                    readOnly
                    value={((parseFloat(value) || 0) * (probability / 100)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    className="w-full bg-[#06080F]/50 border border-[#151B2C]/80 rounded-lg pl-7 pr-3 py-2.5 text-nexus-muted focus:outline-none cursor-not-allowed font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-nexus-muted mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this deal..."
              rows={3}
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078] resize-none"
            />
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
              disabled={loading}
              className="px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg shadow-lg shadow-[#10D078]/20 transition-all duration-200"
            >
              {loading ? "Saving..." : dealData ? "Update Deal" : "Create Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
