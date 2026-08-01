"use client";

import { useState, useEffect } from "react";
import {
  IconBuildingSkyscraper,
  IconUserShield,
  IconUsers,
  IconAddressBook,
  IconLayoutDashboard,
  IconActivity,
  IconChevronRight,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

interface AuditLogEntry {
  id: string;
  action: string;
  actorName: string;
  actorEmail: string;
  targetName?: string;
  summary: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  createdAt: string;
}

const SEVERITY_DOT: Record<string, string> = {
  INFO: "bg-sky-400",
  SUCCESS: "bg-emerald-400",
  WARNING: "bg-amber-400",
  DANGER: "bg-rose-400",
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  const [companyCount, setCompanyCount] = useState(0);
  const [activeCompanyCount, setActiveCompanyCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [activeLeadsCount, setActiveLeadsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveRole =
    user?.role ||
    (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("nexus-user") || "{}").role : null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Admin and User both have their own dedicated dashboard at Lead Metrics — this page is
  // Super Admin's dashboard only.
  useEffect(() => {
    if (isMounted && (effectiveRole === "ADMIN" || effectiveRole === "USER")) {
      router.replace("/leads/metrics");
    }
  }, [isMounted, effectiveRole, router]);

  useEffect(() => {
    if (!isMounted || effectiveRole !== "SUPER_ADMIN") return;

    async function fetchOverview() {
      setLoading(true);
      try {
        const token = localStorage.getItem("nexus-token");
        const headers = { Authorization: `Bearer ${token}` };

        const [companiesRes, usersRes, statsRes, auditRes] = await Promise.all([
          fetch("/api/companies", { headers }),
          fetch("/api/users?grouped=true", { headers }),
          fetch("/api/dashboard/stats", { headers }),
          fetch("/api/audit-logs", { headers }),
        ]);

        if (companiesRes.ok) {
          const companies = await companiesRes.json();
          setCompanyCount(companies.length);
          setActiveCompanyCount(companies.filter((c: any) => c.isActive).length);
        }

        if (usersRes.ok) {
          const { allUsers } = await usersRes.json();
          const active = (allUsers || []).filter((u: any) => !u.isDeleted);
          setAdminCount(active.filter((u: any) => u.role === "ADMIN" || u.role === "SUPER_ADMIN").length);
          setUserCount(active.filter((u: any) => u.role === "USER").length);
        }

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setActiveLeadsCount(stats.activeLeads ?? 0);
        }

        if (auditRes.ok) {
          const logs = await auditRes.json();
          setRecentActivity((logs || []).slice(0, 8));
        }
      } catch (err) {
        console.error("Error fetching platform overview:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOverview();
  }, [isMounted, effectiveRole]);

  if (!isMounted || effectiveRole === "ADMIN" || effectiveRole === "USER") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[#10D078] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    {
      label: "Companies",
      value: `${activeCompanyCount}/${companyCount}`,
      sub: "Active / Total",
      icon: IconBuildingSkyscraper,
      color: "text-[#38BDF8] bg-[#03203C] border-[#0A3A6B]",
      href: "/admin/company-management",
    },
    {
      label: "Admins",
      value: adminCount,
      sub: "Across all companies",
      icon: IconUserShield,
      color: "text-orange-400 bg-[#3A2308] border-[#6B440A]",
      href: "/admin/admin-management",
    },
    {
      label: "Users",
      value: userCount,
      sub: "Across all companies",
      icon: IconUsers,
      color: "text-[#C084FC] bg-[#2E1065] border-[#4C1D95]",
      href: "/admin/user-management",
    },
    {
      label: "Active Leads",
      value: activeLeadsCount,
      sub: "Platform-wide",
      icon: IconAddressBook,
      color: "text-[#10D078] bg-[#063022] border-[#0C583E]",
      href: "/leads/crm",
    },
  ];

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-nexus-primary/10 border border-nexus-primary/20 text-nexus-primary flex items-center justify-center shadow-lg shadow-nexus-primary/5">
          <IconLayoutDashboard size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-nexus-text tracking-tight">Dashboard</h1>
          <p className="text-xs text-nexus-text-secondary">
            Platform-wide overview across all companies, admins, and users.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 flex items-center justify-between shadow-sm hover:border-nexus-primary/40 transition-colors"
          >
            <div>
              <span className="text-[11px] font-bold tracking-wider text-nexus-text-secondary uppercase">
                {c.label}
              </span>
              <div className="text-2xl font-bold text-white mt-1">{loading ? "..." : c.value}</div>
              <div className="text-xs text-nexus-muted mt-0.5">{c.sub}</div>
            </div>
            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${c.color}`}>
              <c.icon size={22} />
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <IconActivity size={18} className="text-nexus-primary" />
            Recent Activity
          </h3>
          <Link
            href="/admin/audit-logs"
            className="text-xs font-semibold text-nexus-primary hover:underline flex items-center gap-0.5"
          >
            View All <IconChevronRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="text-xs text-nexus-muted text-center py-6">Loading activity…</div>
        ) : recentActivity.length === 0 ? (
          <div className="text-xs text-nexus-muted text-center py-6">No recent activity.</div>
        ) : (
          <div className="divide-y divide-[#151B2C]">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[log.severity] || "bg-nexus-muted"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-nexus-text truncate">{log.summary}</p>
                  <p className="text-[11px] text-nexus-muted mt-0.5">
                    {log.actorName} · {timeAgo(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
