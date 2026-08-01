import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { IdleTimerGuard } from "@/components/auth/IdleTimerGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <IdleTimerGuard>
      <div className="flex h-screen overflow-hidden bg-nexus-bg">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <TopHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </div>
    </IdleTimerGuard>
  );
}
