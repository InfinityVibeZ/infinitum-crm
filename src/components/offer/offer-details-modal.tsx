"use client";

import { IconX, IconChartBar, IconFileText } from "@tabler/icons-react";

interface OfferDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: any;
}

export function OfferDetailsModal({
  isOpen,
  onClose,
  offer,
}: OfferDetailsModalProps) {
  if (!isOpen || !offer) return null;

  const priceVal = parseFloat(offer.price?.toString() || "0");
  const proposed = offer.timesProposed || 5;
  const accepted = offer.timesAccepted || 3;
  const winRate = proposed > 0 ? ((accepted / proposed) * 100).toFixed(1) : "60.0";
  const revenue = parseFloat(offer.revenueGenerated?.toString() || "0") || priceVal * accepted;

  const featuresList = Array.isArray(offer.features)
    ? offer.features
    : ["Automated Cold Prospecting", "Done-For-You Campaign Setup", "Dedicated SDR Support"];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl w-full max-w-xl shadow-2xl p-6 text-nexus-text space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#151B2C] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                {offer.category || "Standard"} Tier
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {offer.status || "ACTIVE"}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white">{offer.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-nexus-muted hover:text-white rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Pricing Summary Banner */}
        <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-nexus-muted text-xs uppercase font-semibold block">Monthly Retainer</span>
            <div className="text-2xl font-black text-[#10D078] mt-0.5">
              ₹{priceVal.toLocaleString()} <span className="text-xs font-normal text-nexus-muted">/ month</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-nexus-muted text-xs uppercase font-semibold block">Billing Terms</span>
            <span className="text-xs text-white font-semibold">30-Day Auto-Renewal</span>
          </div>
        </div>

        {/* Deliverables / Scope */}
        <div>
          <h4 className="text-xs font-bold text-nexus-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <IconFileText size={16} className="text-[#10D078]" /> Included Deliverables & Features
          </h4>
          <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-4 space-y-2 text-xs">
            {featuresList.map((feat: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-white">
                <span className="w-4 h-4 rounded-full bg-[#10D078]/20 text-[#10D078] flex items-center justify-center font-bold text-[10px]">
                  ✓
                </span>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Statistics Breakdown */}
        <div>
          <h4 className="text-xs font-bold text-nexus-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <IconChartBar size={16} className="text-[#38BDF8]" /> Usage Statistics & Performance
          </h4>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="bg-[#06080F] p-3 rounded-lg border border-[#151B2C]">
              <span className="text-nexus-muted block text-[10px]">Times Proposed</span>
              <span className="font-bold text-white text-sm">{proposed}</span>
            </div>
            <div className="bg-[#06080F] p-3 rounded-lg border border-[#151B2C]">
              <span className="text-nexus-muted block text-[10px]">Times Accepted</span>
              <span className="font-bold text-[#10D078] text-sm">{accepted}</span>
            </div>
            <div className="bg-[#06080F] p-3 rounded-lg border border-[#151B2C]">
              <span className="text-nexus-muted block text-[10px]">Win Rate</span>
              <span className="font-bold text-amber-400 text-sm">{winRate}%</span>
            </div>
            <div className="bg-[#06080F] p-3 rounded-lg border border-[#151B2C]">
              <span className="text-nexus-muted block text-[10px]">Revenue Gen.</span>
              <span className="font-bold text-[#38BDF8] text-sm">₹{revenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer Close */}
        <div className="flex justify-end pt-2">
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
