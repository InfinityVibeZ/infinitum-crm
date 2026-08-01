"use client";

import { useState } from "react";
import { IconSend, IconPlus, IconFileText, IconUserPlus } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { DealModal } from "@/components/sales/deal-modal";
import { LeadModal } from "@/components/leads/lead-modal";

export default function QuickActionsPage() {
  const router = useRouter();
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
            <IconSend size={24} />
          </span>
          Sales Quick Actions
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Fast shortcuts for creating new deals, sending client proposals, and issuing contracts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          onClick={() => setIsDealModalOpen(true)}
          className="bg-nexus-card border border-nexus-border rounded-xl p-6 hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <IconPlus size={24} />
          </div>
          <h3 className="font-bold text-lg text-nexus-text">Create New Deal</h3>
          <p className="text-xs text-nexus-muted mt-1">
            Initialize an opportunity, link to a lead, and add value & close probability.
          </p>
        </div>

        <div
          onClick={() => router.push("/documents/proposals")}
          className="bg-nexus-card border border-nexus-border rounded-xl p-6 hover:border-purple-500/50 transition-all cursor-pointer shadow-lg group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <IconFileText size={24} />
          </div>
          <h3 className="font-bold text-lg text-nexus-text">Send Client Proposal</h3>
          <p className="text-xs text-nexus-muted mt-1">
            Build and issue customized client proposals linked directly to pipeline deals.
          </p>
        </div>

        <div
          onClick={() => setIsLeadModalOpen(true)}
          className="bg-nexus-card border border-nexus-border rounded-xl p-6 hover:border-nexus-primary/50 transition-all cursor-pointer shadow-lg group"
        >
          <div className="w-12 h-12 rounded-xl bg-nexus-primary/10 text-nexus-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <IconUserPlus size={24} />
          </div>
          <h3 className="font-bold text-lg text-nexus-text">Add New Lead</h3>
          <p className="text-xs text-nexus-muted mt-1">
            Create a lead entry with complete progression milestone tracking.
          </p>
        </div>
      </div>

      <DealModal
        isOpen={isDealModalOpen}
        onClose={() => setIsDealModalOpen(false)}
        onSuccess={() => router.push("/sales/pipeline")}
      />

      <LeadModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onSuccess={() => router.push("/leads/crm")}
      />
    </div>
  );
}
