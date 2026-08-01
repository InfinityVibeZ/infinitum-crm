"use client";

import { useState } from "react";
import { IconActivity, IconPhoneCall, IconMail, IconCalendar } from "@tabler/icons-react";

export default function LeadActivitiesPage() {
  const [activities] = useState([
    { id: "1", type: "CALL", title: "Outbound Call to Zawad Uzzaman", time: "10:30 AM", status: "Completed" },
    { id: "2", type: "EMAIL", title: "Follow-up proposal email sent to Acme Corp", time: "01:15 PM", status: "Sent" },
    { id: "3", type: "MEETING", title: "Discovery Call with Mani Kanasani", time: "03:45 PM", status: "Scheduled" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconActivity size={24} />
          </span>
          Lead Activities Log
        </h1>
        <p className="text-sm text-nexus-text-secondary mt-1">
          Chronological activity tracking across calls, emails, and booked meetings.
        </p>
      </div>

      <div className="bg-nexus-card border border-nexus-border rounded-xl divide-y divide-nexus-border">
        {activities.map((act) => (
          <div key={act.id} className="p-4 flex items-center justify-between hover:bg-nexus-hover/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-nexus-primary/20 text-nexus-primary flex items-center justify-center">
                {act.type === "CALL" ? <IconPhoneCall size={16} /> : act.type === "EMAIL" ? <IconMail size={16} /> : <IconCalendar size={16} />}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-nexus-text">{act.title}</h4>
                <span className="text-xs text-nexus-muted">{act.time}</span>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-nexus-hover border border-nexus-border">
              {act.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
