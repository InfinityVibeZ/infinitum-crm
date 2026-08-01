"use client";

import { IconPlug } from "@tabler/icons-react";

export default function SettingsIntegrationsPage() {
  const integrations = [
    { name: "Supabase PostgreSQL", connected: true, status: "Connected & Synced" },
    { name: "Stripe Payment Gateway", connected: true, status: "Connected" },
    { name: "Slack Notifications", connected: false, status: "Disconnected" },
    { name: "Apollo / Clay Prospecting", connected: true, status: "Connected" },
  ];

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconPlug size={24} />
          </span>
          Third-Party Integrations
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Connect your database, payments, webhooks, and automation tools.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((i) => (
          <div key={i.name} className="bg-nexus-card border border-nexus-border rounded-xl p-5 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-sm text-nexus-text">{i.name}</h4>
              <span className={`text-xs ${i.connected ? "text-emerald-400" : "text-nexus-muted"}`}>{i.status}</span>
            </div>
            <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${i.connected ? "bg-nexus-hover text-nexus-text border-nexus-border" : "bg-nexus-primary text-nexus-bg border-nexus-primary"}`}>
              {i.connected ? "Configure" : "Connect"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
