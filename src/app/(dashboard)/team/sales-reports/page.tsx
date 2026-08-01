"use client";

import { useState, useEffect } from "react";
import { IconUsers, IconTrophy, IconAward, IconPhoneCall } from "@tabler/icons-react";

export default function SalesTeamReportsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/users").then((res) => res.json()),
      fetch("/api/leads").then((res) => res.json()),
      fetch("/api/deals").then((res) => res.json()),
    ])
      .then(([uData, lData, dData]) => {
        if (Array.isArray(uData)) setUsers(uData);
        if (Array.isArray(lData)) setLeads(lData);
        if (Array.isArray(dData)) setDeals(dData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconUsers size={24} />
          </span>
          Sales Team Reports & Performance
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Combined performance dashboard for Setters and Closers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Total Reps</span>
          <div className="text-2xl font-bold mt-1 text-nexus-text">{loading ? "..." : users.length}</div>
        </div>
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Total Calls Booked</span>
          <div className="text-2xl font-bold mt-1 text-sky-400">{loading ? "..." : leads.length}</div>
        </div>
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Deals Pitched</span>
          <div className="text-2xl font-bold mt-1 text-purple-400">{loading ? "..." : deals.length}</div>
        </div>
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <span className="text-xs text-nexus-text-secondary uppercase font-semibold">Revenue Won</span>
          <div className="text-2xl font-bold mt-1 text-emerald-400">
            ₹{deals.reduce((s, d) => s + (parseFloat(d.value) || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
