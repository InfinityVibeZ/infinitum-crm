"use client";

import { useState } from "react";
import { IconArrowUpRight } from "@tabler/icons-react";

export default function CashOutPage() {
  const [expenses] = useState([
    { id: "EXP-501", vendor: "Facebook Ads", category: "Marketing", amount: "₹12,400.00", date: "Jul 15, 2026" },
    { id: "EXP-502", vendor: "OpenAI / Claude API", category: "Software & Tools", amount: "₹1,850.00", date: "Jul 10, 2026" },
    { id: "EXP-503", vendor: "Clay / Apollo Data", category: "Data Scraping", amount: "₹3,200.00", date: "Jul 05, 2026" },
  ]);

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
          <span className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
            <IconArrowUpRight size={24} />
          </span>
          Cash Out & Expenses
        </h1>
        <p className="text-xs text-nexus-text-secondary mt-1">
          Operational costs, marketing ad spend, team payroll, and tool subscriptions.
        </p>
      </div>

      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#151B2C] text-[11px] uppercase text-nexus-muted font-semibold">
              <th className="p-4">Expense ID</th>
              <th className="p-4">Vendor</th>
              <th className="p-4">Category</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151B2C]">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-[#141A29]/60">
                <td className="p-4 font-bold text-[#10D078]">{e.id}</td>
                <td className="p-4 font-semibold text-white">{e.vendor}</td>
                <td className="p-4 text-nexus-muted">{e.category}</td>
                <td className="p-4 text-nexus-muted">{e.date}</td>
                <td className="p-4 text-right font-bold text-rose-400">{e.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
