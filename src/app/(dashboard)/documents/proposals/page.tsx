"use client";

import { useState, useEffect } from "react";
import { IconFileText, IconSend, IconEye, IconPlus } from "@tabler/icons-react";

export default function ProposalsPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deals")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setDeals(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
              <IconFileText size={24} />
            </span>
            Proposals Engine & Builder
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-1">
            Build, issue, and track client proposal documents linked directly to active pipeline deals.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-xs shadow-lg shadow-purple-600/20">
          <IconPlus size={16} />
          <span>New Proposal</span>
        </button>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] uppercase text-nexus-muted font-semibold">
              <th className="p-4">Proposal / Deal</th>
              <th className="p-4">Client / Lead</th>
              <th className="p-4">Service Scope</th>
              <th className="p-4">Total Value</th>
              <th className="p-4">Stage</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-nexus-muted">
                  Loading active proposals...
                </td>
              </tr>
            ) : deals.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-nexus-muted">
                  No active proposal deals found. Create a deal to generate proposals.
                </td>
              </tr>
            ) : (
              deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-[#141A29]/60">
                  <td className="p-4 font-bold text-white">{deal.name}</td>
                  <td className="p-4 text-nexus-text-secondary">{deal.lead?.company || deal.user?.name || "Client"}</td>
                  <td className="p-4 font-semibold text-purple-400">{deal.serviceType || "Custom Systems"}</td>
                  <td className="p-4 font-bold text-[#10D078]">₹{parseFloat(deal.value || "0").toLocaleString()}</td>
                  <td className="p-4">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {deal.stage}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 text-nexus-muted hover:text-white" title="View Preview">
                        <IconEye size={16} />
                      </button>
                      <button className="p-1.5 text-nexus-muted hover:text-[#10D078]" title="Send Client Link">
                        <IconSend size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
