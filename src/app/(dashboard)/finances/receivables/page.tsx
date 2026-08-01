"use client";

import { useState } from "react";
import { IconClock } from "@tabler/icons-react";

export default function ReceivablesPage() {
  const [receivables] = useState([
    { id: "REC-201", client: "Lmnopq, Corp.", pendingAmount: "₹3,000.00", dueDate: "Aug 05, 2026", status: "PENDING_INSTALLMENT" },
    { id: "REC-202", client: "Test Deal Account", pendingAmount: "₹15,000.00", dueDate: "Jul 30, 2026", status: "INVOICED" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
            <IconClock size={24} />
          </span>
          Accounts Receivable
        </h1>
        <p className="text-xs text-nexus-text-secondary mt-1">
          Pending client installments, future invoice collections, and payment schedules.
        </p>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] uppercase text-nexus-muted font-semibold">
              <th className="p-4">Rec ID</th>
              <th className="p-4">Client Name</th>
              <th className="p-4">Pending Amount</th>
              <th className="p-4">Expected Collection Date</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C]">
            {receivables.map((r) => (
              <tr key={r.id} className="hover:bg-[#141A29]/60">
                <td className="p-4 font-bold text-[#10D078]">{r.id}</td>
                <td className="p-4 font-semibold text-white">{r.client}</td>
                <td className="p-4 font-bold text-amber-400">{r.pendingAmount}</td>
                <td className="p-4 text-nexus-muted">{r.dueDate}</td>
                <td className="p-4">
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
