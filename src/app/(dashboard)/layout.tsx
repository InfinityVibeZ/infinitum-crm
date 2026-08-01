"use client";

import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { IdleTimerGuard } from "@/components/auth/IdleTimerGuard";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <IdleTimerGuard>
      <div className="flex h-screen overflow-hidden bg-nexus-bg">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div
          className={`fixed left-0 top-0 h-screen z-50 md:hidden transform transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <TopHeader
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            showMenuButton
          />
          <main className="flex-1 overflow-y-auto">
            <div className="p-3 sm:p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </IdleTimerGuard>
  );
}
