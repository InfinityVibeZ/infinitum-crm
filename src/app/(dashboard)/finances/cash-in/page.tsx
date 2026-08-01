"use client";

import { useState } from "react";
import { IconArrowDownLeft } from "@tabler/icons-react";

export default function CashInPage() {
  const [transactions] = useState([
    { id: "TX-101", source: "Stripe - ABC Corp", amount: "₹5,000.00", date: "Jul 12, 2026", type: "Upfront Deposit" },
    { id: "TX-102", source: "Wire - XYZ Inc", amount: "₹15,000.00", date: "Jul 08, 2026", type: "Full Retainer Payment" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconArrowDownLeft size={24} />
            </span>
            Cash In Transactions
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-1">
            Log of client payments received, Stripe payouts, and bank deposits.
          </p>
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] uppercase text-nexus-muted font-semibold">
              <th className="p-4">Tx ID</th>
              <th className="p-4">Source</th>
              <th className="p-4">Type</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C]">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-[#141A29]/60">
                <td className="p-4 font-bold text-[#10D078]">{tx.id}</td>
                <td className="p-4 font-semibold text-white">{tx.source}</td>
                <td className="p-4 text-nexus-muted">{tx.type}</td>
                <td className="p-4 text-nexus-muted">{tx.date}</td>
                <td className="p-4 text-right font-bold text-[#10D078]">{tx.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
