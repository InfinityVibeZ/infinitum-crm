"use client";

import { useEffect, useState } from "react";


interface LeadAttribution {
  id: string;
  name: string;
  sourcePlatform: string | null;
  adId: string | null;
  campaignId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  contactId: string | null;
}

export default function AttributionPage() {
  const [leads, setLeads] = useState<LeadAttribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAttribution() {
      try {
        const res = await fetch("/api/leads");
        if (res.ok) {
          const data = await res.json();
          setLeads(data.leads || []);
        }
      } catch (e) {
        console.error("Error fetching attribution leads:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchAttribution();
  }, []);

  return (
    <div className="flex flex-col h-full bg-nexus-bg">
      <div className="px-6 py-4 border-b border-nexus-border">
        <h1 className="text-xl font-bold text-nexus-text">Attribution & Acquisition</h1>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-nexus-surface rounded-xl border border-nexus-border overflow-hidden">
            <div className="p-4 border-b border-nexus-border bg-nexus-surface/50">
              <h2 className="font-semibold text-nexus-text">Recent Lead Sources</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-nexus-text-secondary">Loading attribution data...</div>
            ) : leads.length === 0 ? (
              <div className="p-8 text-center text-nexus-text-secondary">No attribution data found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-nexus-text">
                  <thead className="bg-nexus-surface/50 border-b border-nexus-border">
                    <tr>
                      <th className="px-6 py-3 font-medium">Lead</th>
                      <th className="px-6 py-3 font-medium">Platform</th>
                      <th className="px-6 py-3 font-medium">Campaign ID</th>
                      <th className="px-6 py-3 font-medium">Ad ID</th>
                      <th className="px-6 py-3 font-medium">UTM Source</th>
                      <th className="px-6 py-3 font-medium">UTM Medium</th>
                      <th className="px-6 py-3 font-medium">UTM Campaign</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nexus-border">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-nexus-surface/50 transition-colors">
                        <td className="px-6 py-4 font-medium">{lead.name || "Unknown"}</td>
                        <td className="px-6 py-4">
                          {lead.sourcePlatform ? (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-md">
                              {lead.sourcePlatform}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-4 text-nexus-text-secondary font-mono text-xs">{lead.campaignId || "—"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary font-mono text-xs">{lead.adId || "—"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary">{lead.utmSource || "—"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary">{lead.utmMedium || "—"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary">{lead.utmCampaign || "—"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
