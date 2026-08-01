"use client";

import { useState } from "react";
import { IconFileCheck } from "@tabler/icons-react";

export default function ContractsPage() {
  const [contracts] = useState([
    { id: "CTR-901", client: "ABC Corp Systems", value: "₹15,000.00", signedDate: "Jul 12, 2026", status: "EXECUTED" },
    { id: "CTR-902", client: "Lmnopq, Corp.", value: "₹3,000.00", signedDate: "Pending", status: "SENT_FOR_SIGNATURE" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconFileCheck size={24} />
            </span>
            Client Contracts
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-1">
            Manage legal agreements, service terms, and e-signatures.
          </p>
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] uppercase text-nexus-muted font-semibold">
              <th className="p-4">Contract #</th>
              <th className="p-4">Client</th>
              <th className="p-4">Value</th>
              <th className="p-4">Date</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C]">
            {contracts.map((c) => (
              <tr key={c.id} className="hover:bg-[#141A29]/60">
                <td className="p-4 font-bold text-[#10D078]">{c.id}</td>
                <td className="p-4 font-semibold text-white">{c.client}</td>
                <td className="p-4 font-bold text-[#10D078]">{c.value}</td>
                <td className="p-4 text-nexus-muted">{c.signedDate}</td>
                <td className="p-4">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                    {c.status}
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
