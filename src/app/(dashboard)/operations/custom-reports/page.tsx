"use client";

import { IconFileAnalytics } from "@tabler/icons-react";

export default function CustomReportsPage() {
  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconFileAnalytics size={24} />
          </span>
          Custom Operations Reports
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Create, export, and schedule custom reporting parameters across sales, leads, and finances.
        </p>
      </div>

      <div className="bg-nexus-card border border-nexus-border rounded-xl p-8 text-center text-nexus-muted text-sm">
        Select metrics and date ranges to generate a custom executive report export.
      </div>
    </div>
  );
}
