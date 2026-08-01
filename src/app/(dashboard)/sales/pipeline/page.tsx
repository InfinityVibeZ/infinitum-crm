"use client";

import { useState, useEffect } from "react";
import {
  IconPlus,
  IconChartBar,
  IconSearch,
  IconFilter,
  IconTrash,
  IconBuilding,
  IconMail,
  IconUser,
  IconPhone,
  IconCalendar,
  IconClock,
  IconTrendingUp,
  IconAward,
  IconX,
} from "@tabler/icons-react";
import { DealModal } from "@/components/sales/deal-modal";

// ─── Pipeline Stages with Subtitles ──────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    id: "NEW_OPPORTUNITY",
    label: "New Opportunity",
    subtitle: "Lead converted to active opportunity",
    color: "border-sky-500",
    dotColor: "bg-sky-500",
  },
  {
    id: "DISCOVERY_SCHEDULED",
    label: "Discovery Scheduled",
    subtitle: "Initial consultation booked",
    color: "border-sky-400",
    dotColor: "bg-sky-400",
  },
  {
    id: "DISCOVERY_COMPLETED",
    label: "Discovery Completed",
    subtitle: "Needs assessment finished",
    color: "border-teal-400",
    dotColor: "bg-teal-400",
  },
  {
    id: "PROPOSAL_PREP",
    label: "Proposal Prep",
    subtitle: "Creating custom proposal",
    color: "border-purple-400",
    dotColor: "bg-purple-400",
  },
  {
    id: "PROPOSAL_SENT",
    label: "Proposal Sent",
    subtitle: "Proposal delivered to prospect",
    color: "border-indigo-400",
    dotColor: "bg-indigo-400",
  },
  {
    id: "NEGOTIATION",
    label: "Negotiation",
    subtitle: "Contract & pricing terms discussion",
    color: "border-amber-400",
    dotColor: "bg-amber-400",
  },
  {
    id: "CONTRACT_SENT",
    label: "Contract Sent",
    subtitle: "Legal contract awaiting signature",
    color: "border-orange-400",
    dotColor: "bg-orange-400",
  },
  {
    id: "CONTRACT_SIGNED",
    label: "Contract Signed",
    subtitle: "Agreement executed successfully",
    color: "border-emerald-400",
    dotColor: "bg-emerald-400",
  },
  {
    id: "PROJECT_KICKOFF",
    label: "Project Kickoff",
    subtitle: "Client onboarding & project start",
    color: "border-emerald-500",
    dotColor: "bg-emerald-500",
  },
  {
    id: "ON_HOLD",
    label: "On Hold",
    subtitle: "Opportunity paused temporarily",
    color: "border-gray-500",
    dotColor: "bg-gray-500",
  },
];

// Service type badge colors
const SERVICE_BADGES: Record<string, string> = {
  Consulting: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Software Development": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "AI & Automation": "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  "Ongoing Support": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "Custom Projects": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Marketing & Lead Gen": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Default: "bg-nexus-bg text-nexus-text-secondary border-nexus-border",
};

function formatCurrency(val: number) {
  return `₹ ${val.toLocaleString("en-IN")}`;
}

function formatDateShort(d?: string) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function calcDaysInStage(createdAt?: string) {
  if (!createdAt) return 0;
  const diffTime = Math.abs(Date.now() - new Date(createdAt).getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export default function SalesPipelinePage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("ALL");
  const [filterService, setFilterService] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deals");
      const data = await res.json();
      if (Array.isArray(data)) setDeals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.setData("text/plain", dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (stageId: string) => {
    setDragOverStageId(stageId);
  };

  const handleDragLeave = (e: React.DragEvent, stageId: string) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    if (dragOverStageId === stageId) setDragOverStageId(null);
  };

  const handleCardDragOver = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCardId !== cardId) {
      setDragOverCardId(cardId);
    }
  };

  const handleCardDragLeave = (e: React.DragEvent, cardId: string) => {
    e.stopPropagation();
    if (dragOverCardId === cardId) {
      setDragOverCardId(null);
    }
  };

  const executeMoveDeal = async (sourceDealId: string, targetStageId: string, targetDealId?: string) => {
    setDeals((prevDeals) => {
      const copy = [...prevDeals];
      const sourceIdx = copy.findIndex((d) => d.id === sourceDealId);
      if (sourceIdx === -1) return prevDeals;

      const [moved] = copy.splice(sourceIdx, 1);
      const updatedMoved = { ...moved, stage: targetStageId };

      if (targetDealId) {
        const targetIdx = copy.findIndex((d) => d.id === targetDealId);
        if (targetIdx !== -1) {
          copy.splice(targetIdx, 0, updatedMoved);
          return copy;
        }
      }

      copy.push(updatedMoved);
      return copy;
    });

    try {
      const res = await fetch(`/api/deals/${sourceDealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: targetStageId }),
      });
      if (!res.ok) fetchDeals();
    } catch (err) {
      console.error("Failed to update deal stage:", err);
      fetchDeals();
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    setDragOverCardId(null);
    const dealId = e.dataTransfer.getData("text/plain") || draggedDealId;
    setDraggedDealId(null);
    if (!dealId) return;

    await executeMoveDeal(dealId, targetStageId);
  };

  const handleCardDrop = async (e: React.DragEvent, targetDeal: any, targetStageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStageId(null);
    setDragOverCardId(null);

    const sourceDealId = e.dataTransfer.getData("text/plain") || draggedDealId;
    setDraggedDealId(null);
    if (!sourceDealId || sourceDealId === targetDeal.id) return;

    await executeMoveDeal(sourceDealId, targetStageId, targetDeal.id);
  };


  // Get unique service types for filter (predefined + any custom ones from DB)
  const serviceTypes = Array.from(
    new Set([
      "Consulting",
      "Software Development",
      "AI & Automation",
      "Ongoing Support",
      "Custom Projects",
      "Marketing & Lead Gen",
      ...deals.map((d) => d.serviceType).filter(Boolean),
    ])
  );

  // Filter deals
  const filteredDeals = deals.filter((d) => {
    const leadName = d.lead ? `${d.lead.firstName} ${d.lead.lastName}` : "";
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.lead?.company && d.lead.company.toLowerCase().includes(search.toLowerCase())) ||
      leadName.toLowerCase().includes(search.toLowerCase());
    const matchStage = filterStage === "ALL" || d.stage === filterStage;
    const matchService = filterService === "ALL" || d.serviceType === filterService;
    return matchSearch && matchStage && matchService;
  });

  const pipelineValue = deals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

  const wonDealsCount = deals.filter((d) =>
    ["CONTRACT_SIGNED", "PROJECT_KICKOFF", "CLOSED_WON"].includes(d.stage)
  ).length;

  const lostDealsCount = deals.filter((d) => d.stage === "CLOSED_LOST").length;

  return (
    <div className="space-y-6 text-nexus-text font-sans">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5">
            <IconChartBar size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-nexus-text tracking-tight">
              Sales Pipeline
            </h1>
            <p className="text-xs text-nexus-text-secondary">
              Track deals through your consulting sales process
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingDeal(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-xl transition-all shadow-lg shadow-emerald-500/20 self-start sm:self-auto text-xs"
        >
          <IconPlus size={16} />
          <span>New Deal</span>
        </button>
      </div>

      {/* ── TOP METRIC CARDS (Matching Reference Image) ──────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <IconChartBar size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-nexus-muted uppercase tracking-wider">Total Deals</p>
            <div className="text-2xl font-black text-nexus-text">{deals.length}</div>
            <p className="text-xs text-nexus-text-secondary font-medium">Active pipeline</p>
          </div>
        </div>

        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
            <IconTrendingUp size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-nexus-muted uppercase tracking-wider">Pipeline Value</p>
            <div className="text-2xl font-black text-emerald-400">{formatCurrency(pipelineValue)}</div>
            <p className="text-xs text-nexus-text-secondary font-medium">Total potential</p>
          </div>
        </div>

        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center flex-shrink-0">
            <IconAward size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-nexus-muted uppercase tracking-wider">Won Deals</p>
            <div className="text-2xl font-black text-teal-400">{wonDealsCount}</div>
            <p className="text-xs text-nexus-text-secondary font-medium">Closed won deals</p>
          </div>
        </div>

        <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-450 flex items-center justify-center flex-shrink-0">
            <IconX size={24} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-nexus-muted uppercase tracking-wider">Lost Deals</p>
            <div className="text-2xl font-black text-rose-450">{lostDealsCount}</div>
            <p className="text-xs text-nexus-text-secondary font-medium">Closed lost deals</p>
          </div>
        </div>
      </div>

      {/* ── FILTERS BAR (Matching Reference Image) ───────────────────────── */}
      <div className="bg-nexus-card border border-nexus-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-nexus-text">
          <IconFilter size={15} className="text-nexus-muted" />
          <span>Filters</span>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary"
            />
          </div>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-2 text-xs bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text focus:outline-none focus:border-nexus-primary"
          >
            <option value="ALL">All Stages</option>
            {PIPELINE_STAGES.map((stg) => (
              <option key={stg.id} value={stg.id}>{stg.label}</option>
            ))}
          </select>

          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="px-3 py-2 text-xs bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text focus:outline-none focus:border-nexus-primary"
          >
            <option value="ALL">All Services</option>
            {serviceTypes.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 10-STAGE KANBAN BOARD (Matching Reference Image) ───────────────── */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 min-w-[3200px]">
          {PIPELINE_STAGES.map((stg) => {
            const stageDeals = filteredDeals.filter((d) => d.stage === stg.id);
            const stageTotalValue = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
            const avgProb = stageDeals.length > 0 ? Math.round(stageDeals.reduce((sum, d) => sum + (d.probability || 0), 0) / stageDeals.length) : 0;
            const isDragTarget = dragOverStageId === stg.id;

            return (
              <div
                key={stg.id}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(stg.id)}
                onDragLeave={(e) => handleDragLeave(e, stg.id)}
                onDrop={(e) => handleDrop(e, stg.id)}
                className={`w-[310px] shrink-0 bg-nexus-card border rounded-2xl flex flex-col max-h-[820px] shadow-md overflow-hidden transition-all ${
                  isDragTarget
                    ? "border-nexus-primary bg-nexus-primary/10 ring-2 ring-nexus-primary/30"
                    : "border-nexus-border"
                }`}
              >
                {/* Column Header */}
                <div className="p-4 border-b border-nexus-border space-y-1 bg-nexus-bg/50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${stg.dotColor}`} />
                      <span className="font-extrabold text-xs text-nexus-text truncate">{stg.label}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-nexus-bg border border-nexus-border text-nexus-muted">
                      {stageDeals.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-nexus-muted leading-tight truncate">{stg.subtitle}</p>
                </div>

                {/* Subtotal Value & Avg Prob Header */}
                <div className="px-4 py-2 bg-nexus-bg/30 border-b border-nexus-border text-[11px] flex justify-between items-center font-bold">
                  <span className="text-emerald-400">{formatCurrency(stageTotalValue)}</span>
                  <span className="text-nexus-muted flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {avgProb}%
                  </span>
                </div>

                {/* Cards Container */}
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {loading && (
                    <div className="p-6 text-center text-nexus-muted text-xs">Loading…</div>
                  )}

                  {!loading && stageDeals.length === 0 ? (
                    <div className={`p-8 text-center text-nexus-muted text-[11px] border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 my-2 transition-colors ${
                      isDragTarget ? "border-nexus-primary text-nexus-primary bg-nexus-primary/5" : "border-nexus-border"
                    }`}>
                      <div className="w-8 h-8 rounded-full bg-nexus-bg border border-nexus-border flex items-center justify-center">
                        <IconTrendingUp size={16} className="opacity-40" />
                      </div>
                      <span>{isDragTarget ? "Drop deal here" : "No deals in this stage"}</span>
                    </div>
                  ) : (
                    stageDeals.map((deal) => {
                      const dealVal = parseFloat(deal.value || "0");
                      const leadObj = deal.lead;
                      const leadName = leadObj ? `${leadObj.firstName} ${leadObj.lastName}`.trim() : null;
                      const ownerName = deal.user?.name || "Unassigned";
                      const companyName = leadObj?.company || deal.company || null;
                      const email = leadObj?.email || null;
                      const phone = leadObj?.phone || null;
                      const closeDateFormatted = formatDateShort(deal.expectedCloseDate);
                      const daysInStage = calcDaysInStage(deal.createdAt);
                      const isBeingDragged = draggedDealId === deal.id;
                      const isCardTarget = dragOverCardId === deal.id;
                      const badgeStyle = SERVICE_BADGES[deal.serviceType] || SERVICE_BADGES.Default;

                      return (
                        <div
                          key={deal.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          onDragOver={(e) => handleCardDragOver(e, deal.id)}
                          onDragLeave={(e) => handleCardDragLeave(e, deal.id)}
                          onDrop={(e) => handleCardDrop(e, deal, stg.id)}
                          onClick={() => {
                            setEditingDeal(deal);
                            setIsModalOpen(true);
                          }}
                          className={`bg-nexus-bg border rounded-xl p-3.5 shadow-sm hover:border-nexus-primary/60 cursor-grab active:cursor-grabbing transition-all space-y-2.5 group relative ${
                            isBeingDragged
                              ? "opacity-30 border-dashed border-nexus-primary scale-[0.98]"
                              : isCardTarget
                              ? "border-nexus-primary ring-2 ring-nexus-primary/40 bg-nexus-primary/5 translate-y-1"
                              : "border-nexus-border"
                          }`}
                        >
                          {/* Top Row: Deal Name + Prob Badge */}
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-xs text-nexus-text group-hover:text-nexus-primary transition-colors leading-snug truncate">
                              {deal.name}
                            </h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex-shrink-0">
                              {deal.probability || 50}%
                            </span>
                          </div>

                          {/* Contact Lead Name */}
                          {leadName && (
                            <p className="text-[11px] text-nexus-muted font-medium truncate">{leadName}</p>
                          )}

                          {/* Deal Value */}
                          <div className="text-base font-extrabold text-emerald-400">
                            {formatCurrency(dealVal)}
                          </div>

                          {/* Service Type Pill Tag */}
                          {deal.serviceType && (
                            <div>
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                                {deal.serviceType}
                              </span>
                            </div>
                          )}

                          {/* Detailed Context Info */}
                          <div className="space-y-1 pt-1 text-[11px] text-nexus-muted border-t border-nexus-border/50">
                            {companyName && (
                              <div className="flex items-center gap-1.5 truncate">
                                <IconBuilding size={12} className="text-nexus-muted flex-shrink-0" />
                                <span className="truncate">{companyName}</span>
                              </div>
                            )}

                            {email && !email.endsWith("@nexus.internal") && (
                              <div className="flex items-center gap-1.5 truncate">
                                <IconMail size={12} className="text-nexus-muted flex-shrink-0" />
                                <span className="truncate">{email}</span>
                              </div>
                            )}

                            {ownerName && (
                              <div className="flex items-center gap-1.5 truncate">
                                <IconUser size={12} className="text-nexus-muted flex-shrink-0" />
                                <span className="truncate">{ownerName}</span>
                              </div>
                            )}

                            {phone && (
                              <div className="flex items-center gap-1.5 truncate">
                                <IconPhone size={12} className="text-nexus-muted flex-shrink-0" />
                                <span className="truncate">{phone}</span>
                              </div>
                            )}

                            {closeDateFormatted && (
                              <div className="flex items-center gap-1.5 truncate">
                                <IconCalendar size={12} className="text-nexus-muted flex-shrink-0" />
                                <span>Close: {closeDateFormatted}</span>
                              </div>
                            )}
                          </div>

                          {/* Footer: Stage Duration & Source */}
                          <div className="flex justify-between items-center pt-2 border-t border-nexus-border/60 text-[10px] text-nexus-muted">
                            <span className="flex items-center gap-1">
                              <IconClock size={11} />
                              {daysInStage} days in stage
                            </span>
                            {deal.dealSource && (
                              <span className="font-semibold text-nexus-text-secondary">{deal.dealSource}</span>
                            )}
                          </div>


                        </div>
                      );
                    }))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dealData={editingDeal}
        onSuccess={fetchDeals}
      />
    </div>
  );
}
