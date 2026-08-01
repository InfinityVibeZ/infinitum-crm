"use client";

import { useState, useEffect } from "react";
import {
  IconSearch,
  IconPlus,
  IconChartBar,
  IconCurrencyRupee,
  IconTarget,
  IconAward,
  IconSparkles,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { DealModal } from "@/components/sales/deal-modal";

export default function SalesCRMPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (stageFilter !== "ALL") query.append("stage", stageFilter);
      if (serviceFilter !== "ALL") query.append("serviceType", serviceFilter);

      const res = await fetch(`/api/deals?${query.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setDeals(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, [search, stageFilter, serviceFilter]);

  const handleStageChange = async (dealId: string, newStage: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) fetchDeals();
    } catch (err) {
      console.error(err);
    }
  };


  // Metric Banner Calculations
  const totalDeals = deals.length;
  const pipelineValue = deals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
  const weightedValue = deals.reduce(
    (sum, d) => sum + ((parseFloat(d.value) || 0) * (d.probability || 0)) / 100,
    0
  );
  const wonDeals = deals.filter(
    (d) => d.stage === "CONTRACT_SIGNED" || d.stage === "PROJECT_KICKOFF" || d.stage === "CLOSED_WON"
  ).length;
  const winRate = totalDeals > 0 ? ((wonDeals / totalDeals) * 100).toFixed(1) : "0.0";

  const getStageBadgeStyle = (stage: string) => {
    switch (stage) {
      case "NEW_OPPORTUNITY":
        return "bg-[#1E293B] text-[#38BDF8] border-[#38BDF8]/30";
      case "DISCOVERY_SCHEDULED":
        return "bg-[#0F2942] text-[#0EA5E9] border-[#0EA5E9]/30";
      case "DISCOVERY_COMPLETED":
        return "bg-[#132A3E] text-[#2DD4BF] border-[#2DD4BF]/30";
      case "PROPOSAL_PREP":
        return "bg-[#1E1B4B] text-[#818CF8] border-[#818CF8]/30";
      case "PROPOSAL_SENT":
        return "bg-[#311B92]/40 text-[#A78BFA] border-[#A78BFA]/30";
      case "NEGOTIATION":
        return "bg-[#431407] text-[#FB923C] border-[#FB923C]/30";
      case "CONTRACT_SENT":
        return "bg-[#3B2506] text-[#FBBF24] border-[#FBBF24]/30";
      case "CONTRACT_SIGNED":
      case "CLOSED_WON":
        return "bg-[#064E3B] text-[#34D399] border-[#34D399]/30";
      case "PROJECT_KICKOFF":
        return "bg-[#065F46] text-[#6EE7B7] border-[#6EE7B7]/30";
      case "ON_HOLD":
        return "bg-[#1F2937] text-[#9CA3AF] border-[#9CA3AF]/30";
      default:
        return "bg-nexus-hover text-nexus-text-secondary border-nexus-border";
    }
  };

  const getServiceTypeStyle = (service?: string) => {
    switch (service) {
      case "AIGC Systems":
        return "text-[#C084FC]"; // Lavender Purple
      case "Ongoing Support":
        return "text-[#F43F5E]"; // Rose Red
      case "Custom Projects":
        return "text-[#38BDF8]"; // Sky Blue
      default:
        return "text-[#A855F7]";
    }
  };

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10D078]/10 border border-[#10D078]/20 text-[#10D078] flex items-center justify-center shadow-lg shadow-[#10D078]/5">
            <IconChartBar size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#10D078] tracking-tight">
              Sales CRM
            </h1>
            <p className="text-xs text-nexus-text-secondary">
              Manage and track your deals through the sales pipeline.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingDeal(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg transition-all shadow-lg shadow-[#10D078]/20 self-start md:self-auto text-sm"
        >
          <IconPlus size={18} />
          <span>Add Deal</span>
        </button>
      </div>

      {/* Top Metric Cards Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Deals */}
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex items-start justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-semibold text-nexus-text-secondary">Total Deals</span>
            <div className="text-2xl font-bold text-white mt-1">{totalDeals}</div>
            <div className="text-[11px] font-semibold text-[#10D078] flex items-center gap-1 mt-1">
              <span>^</span> Active pipeline
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#0F172A] border border-[#1E293B] text-[#10D078] flex items-center justify-center">
            <IconChartBar size={18} />
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex items-start justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-semibold text-nexus-text-secondary">Pipeline Value</span>
            <div className="text-2xl font-bold text-white mt-1">₹{pipelineValue.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-[#38BDF8] flex items-center gap-1 mt-1">
              <span>₹</span> Total potential
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#03203C] border border-[#0A3A6B] text-[#38BDF8] flex items-center justify-center">
            <IconCurrencyRupee size={18} />
          </div>
        </div>

        {/* Weighted Value */}
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex items-start justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-semibold text-nexus-text-secondary">Weighted Value</span>
            <div className="text-2xl font-bold text-[#10D078] mt-1">₹{weightedValue.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-[#10D078] flex items-center gap-1 mt-1">
              <span>@</span> Probability adjusted
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#063022] border border-[#0C583E] text-[#10D078] flex items-center justify-center">
            <IconTarget size={18} />
          </div>
        </div>

        {/* Won Deals */}
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex items-start justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-semibold text-nexus-text-secondary">Won Deals</span>
            <div className="text-2xl font-bold text-white mt-1">{wonDeals}</div>
            <div className="text-[11px] font-semibold text-[#10D078] flex items-center gap-1 mt-1">
              <span>&</span> Closed won
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#042F2C] border border-[#0D5C56] text-[#2DD4BF] flex items-center justify-center">
            <IconAward size={18} />
          </div>
        </div>
      </div>

      {/* Table & Filter Controls Container */}
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl shadow-sm overflow-hidden">
        {/* Filter Bar Row */}
        <div className="p-4 border-b border-[#151B2C] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <IconSearch
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals..."
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-nexus-muted focus:outline-none focus:border-[#10D078]"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Stages</option>
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

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Services</option>
            <option value="Consulting">Consulting</option>
            <option value="Software Development">Software Development</option>
            <option value="AI & Automation">AI & Automation</option>
            <option value="Ongoing Support">Ongoing Support</option>
            <option value="Custom Projects">Custom Projects</option>
            <option value="Marketing & Lead Gen">Marketing & Lead Gen</option>
          </select>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#151B2C] text-[11px] font-semibold text-nexus-text-secondary">
                <th className="p-4">Deal Name</th>
                <th className="p-4">Stage</th>
                <th className="p-4">Service Type</th>
                <th className="p-4">Deal Value</th>
                <th className="p-4">Probability</th>
                <th className="p-4">Expected Close</th>
                <th className="p-4">Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151B2C] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-nexus-muted">
                    Loading deals...
                  </td>
                </tr>
              ) : deals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-nexus-muted">
                    No deals found. Click <strong>+ Add Deal</strong> to create one.
                  </td>
                </tr>
              ) : (
                deals.map((deal) => {
                  const dealVal = parseFloat(deal.value || "0");
                  const weightVal = (dealVal * (deal.probability || 0)) / 100;

                  return (
                    <tr
                      key={deal.id}
                      className="hover:bg-[#141A29]/60 transition-colors"
                    >

                      {/* Deal Name & Rep */}
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">
                          {deal.name}
                        </div>
                        <div className="text-[11px] text-nexus-muted mt-0.5">
                          {deal.user?.name || "Zawad Uzzaman"}
                          {deal.lead?.company ? ` • ${deal.lead.company}` : ""}
                        </div>
                      </td>

                      {/* Stage Badge */}
                      <td className="p-4">
                        <select
                          value={deal.stage}
                          onChange={(e) => handleStageChange(deal.id, e.target.value)}
                          className={`text-[11px] font-medium px-3 py-1 rounded-full border cursor-pointer focus:outline-none ${getStageBadgeStyle(
                            deal.stage
                          )}`}
                        >
                          <option value="NEW_OPPORTUNITY">New Opportunity ▾</option>
                          <option value="DISCOVERY_SCHEDULED">Discovery Scheduled ▾</option>
                          <option value="DISCOVERY_COMPLETED">Discovery Completed ▾</option>
                          <option value="PROPOSAL_PREP">Proposal Prep ▾</option>
                          <option value="PROPOSAL_SENT">Proposal Sent ▾</option>
                          <option value="NEGOTIATION">Negotiation ▾</option>
                          <option value="CONTRACT_SENT">Contract Sent ▾</option>
                          <option value="CONTRACT_SIGNED">Contract Signed ▾</option>
                          <option value="PROJECT_KICKOFF">Project Kickoff ▾</option>
                          <option value="ON_HOLD">On Hold ▾</option>
                        </select>
                      </td>

                      {/* Service Type Tag */}
                      <td className="p-4">
                        <span className={`font-semibold text-xs ${getServiceTypeStyle(deal.serviceType)}`}>
                          {deal.serviceType || "AIGC Systems"}
                        </span>
                      </td>

                      {/* Deal Value */}
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">
                          ₹{dealVal.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-nexus-muted">
                          Weighted: ₹{weightVal.toLocaleString()}
                        </div>
                      </td>

                      {/* Probability Scale Bar */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">
                            {deal.probability}%
                          </span>
                          <div className="w-14 bg-[#151B2C] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 h-full rounded-full"
                              style={{ width: `${Math.max(10, deal.probability)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Expected Close Date */}
                      <td className="p-4 text-nexus-text-secondary text-xs">
                        {deal.expectedCloseDate
                          ? new Date(deal.expectedCloseDate).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Jul 17, 2026"}
                      </td>

                      {/* Created Date */}
                      <td className="p-4 text-nexus-muted text-xs">
                        {new Date(deal.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingDeal(deal);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-nexus-muted hover:text-[#10D078] rounded-lg transition-colors"
                          >
                            <IconEdit size={15} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#151B2C] flex items-center justify-between text-xs text-nexus-muted">
          <div>
            Showing <strong className="text-white">1 to {deals.length}</strong> of {deals.length} deals
          </div>
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select className="bg-[#06080F] border border-[#151B2C] rounded px-2 py-1 text-xs text-white focus:outline-none">
              <option value="10">10 ▾</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span>per page</span>
          </div>
        </div>
      </div>

      {/* Modal Component */}
      <DealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dealData={editingDeal}
        onSuccess={fetchDeals}
      />
    </div>
  );
}
