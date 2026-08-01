"use client";

import { useState } from "react";
import { IconReceipt, IconPlus } from "@tabler/icons-react";

export default function InvoicesPage() {
  const [invoices] = useState([
    { id: "INV-1001", client: "ABC Corp Systems", amount: "₹15,000.00", status: "PAID", dueDate: "Jul 10, 2026" },
    { id: "INV-1002", client: "Lmnopq, Corp.", amount: "₹3,000.00", status: "SENT", dueDate: "Aug 01, 2026" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconReceipt size={24} />
            </span>
            Invoices Engine
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-1">
            Receivables billing, automated client reminders, and payment tracking.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg text-xs shadow-lg shadow-[#10D078]/20">
          <IconPlus size={16} />
          <span>Issue Invoice</span>
        </button>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] uppercase text-nexus-muted font-semibold">
              <th className="p-4">Invoice #</th>
              <th className="p-4">Client</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Due Date</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C]">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-[#141A29]/60">
                <td className="p-4 font-bold text-[#10D078]">{inv.id}</td>
                <td className="p-4 font-semibold text-white">{inv.client}</td>
                <td className="p-4 font-bold text-white">{inv.amount}</td>
                <td className="p-4 text-nexus-muted">{inv.dueDate}</td>
                <td className="p-4">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      inv.status === "PAID"
                        ? "bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20"
                        : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                    }`}
                  >
                    {inv.status}
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
