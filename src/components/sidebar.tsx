"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconGift,
  IconAddressBook,
  IconChartBar,
  IconFileText,
  IconCash,
  IconCheckbox,
  IconRobot,
  IconSettings,
  IconChevronDown,
  IconChevronUp,
  IconLogout,
  IconUsers,
  IconUserShield,
  IconShieldLock,
  IconBuildingCommunity,
  IconListCheck,
  IconBook2,
  IconTool,
  IconKey,
  IconAlertTriangle,
  IconActivity,
  IconChartPie,
  IconMessage,
  IconCrown,
  IconArchive,
  IconInfinity,
} from "@tabler/icons-react";
import { useSidebarStore } from "@/store/sidebar";
import { useAuthStore } from "@/store/auth";
import { DEFAULT_PAGE_PERMISSIONS as DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { useRouter } from "next/navigation";

interface MenuItem {
  label: string;
  href: string;
}

interface MenuSection {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

// ─── Role-based menu definitions ─────────────────────────────────────────────

function getSuperAdminMenu(): MenuSection[] {
  return [
    {
      label: "PLATFORM",
      icon: <IconBuildingCommunity size={18} />,
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Organizations", href: "/admin/organizations" },
        { label: "Plans", href: "/admin/plans" },
        { label: "Features", href: "/admin/features" },
        { label: "Entitlements", href: "/admin/entitlements" },
        { label: "Usage", href: "/admin/usage" },
        { label: "Billing", href: "/admin/billing" },
        { label: "Audit Logs", href: "/admin/audit-logs" },
        { label: "Meta Integration", href: "/admin/integrations/meta" },
      ],
    },
    {
      label: "USER MANAGEMENT",
      icon: <IconUsers size={18} />,
      items: [
        { label: "User Management", href: "/admin/user-management" },
      ],
    },
    {
      label: "SYSTEM",
      icon: <IconTool size={18} />,
      items: [
        { label: "Menu Permissions", href: "/admin/permissions" },
        { label: "API Keys", href: "/settings/api-keys" },
      ],
    },
  ];
}

function getAdminMenu(): MenuSection[] {
  return [
    {
      label: "LEADS & CONTACTS",
      icon: <IconAddressBook size={18} />, // Existing
      items: [
        { label: "Leads", href: "/leads/crm" },
        { label: "Contacts", href: "/contacts" },
      ],
    },
    {
      label: "ACQUISITION",
      icon: <IconChartBar size={18} />, // Existing
      items: [
        { label: "Integrations", href: "/settings/integrations" },
        { label: "Attribution", href: "/attribution" },
      ],
    },
    {
      label: "AUTOMATION",
      icon: <IconRobot size={18} />, // Existing
      items: [
        { label: "Assignment Rules", href: "/settings/assignment-rules" },
      ],
    },
    {
      label: "ORGANIZATION",
      icon: <IconUsers size={18} />, // Existing
      items: [
        { label: "Users", href: "/admin/user-management" },
        { label: "Teams", href: "/settings/team" },
        { label: "Subscription", href: "/settings/subscription" },
      ],
    },
    {
      label: "INBOX",
      icon: <IconMessage size={18} />, // New Inbox Section
      items: [
        { label: "Inbox", href: "/inbox" },
      ],
    },
    {
      label: "SETTINGS",
      icon: <IconSettings size={18} />, // Existing
      items: [
        { label: "My Profile", href: "/settings/profile" },
      ],
    },
  ];
}

function getUserMenu(): MenuSection[] {
  return [
    {
      label: "LEADS \u0026 CONTACTS",
      icon: <IconAddressBook size={18} />,
      items: [
        { label: "My Leads", href: "/leads/crm" },
        { label: "Contacts", href: "/contacts" },
      ],
    },
    {
      label: "INBOX",
      icon: <IconMessage size={18} />,
      items: [
        { label: "Inbox", href: "/inbox" },
      ],
    },
    {
      label: "SETTINGS",
      icon: <IconSettings size={18} />,
      items: [
        { label: "My Profile", href: "/settings/profile" },
      ],
    },
  ];
}

// ─── Role badge config ────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "text-red-400 bg-red-500/15 border-red-500/30" },
  ADMIN: { label: "Admin", color: "text-orange-400 bg-orange-500/15 border-orange-500/30" },
  USER: { label: "User", color: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
};

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({
  onClose,
  permissions,
}: {
  onClose?: () => void;
  permissions?: Record<string, boolean>;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { expandedSections, toggleSection, setExclusiveSection } = useSidebarStore();
  const { user, logout } = useAuthStore();
  const [showUserDropdown, setShowUserDropdown] = useState(false);



  // Compute effective user role immediately without fallback flicker to USER
  const effectiveRole = useMemo(() => {
    if (user?.role) return user.role;
    if (typeof window !== "undefined") {
      try {
        const userStr = localStorage.getItem("nexus-user");
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u?.role) return u.role;
        }
        const match = document.cookie.match(new RegExp('(^| )nexus-role=([^;]+)'));
        if (match) return decodeURIComponent(match[2]);
      } catch (e) { }
    }
    return "USER";
  }, [user?.role]);

  const menuSections = useMemo(() => {
    const role = effectiveRole;
    const rawSections = role === "SUPER_ADMIN" ? getSuperAdminMenu() : role === "ADMIN" ? getAdminMenu() : getUserMenu();

    // Use server-passed permissions if available, otherwise use DEFAULT_PERMISSIONS
    const activePermissions = permissions || DEFAULT_PERMISSIONS;

    return rawSections
      .map((section) => {
        const filteredItems = section.items.filter((item) => {
          // Hardcode protection for Change Password and Super Admin lockout
          if (item.href === "/settings/security") {
            return true;
          }
          if (item.href === "/admin/permissions" && role === "SUPER_ADMIN") {
            return true;
          }

          const dbAccess = activePermissions[item.href];
          const pageAccess = dbAccess !== undefined ? dbAccess : DEFAULT_PERMISSIONS[item.href];

          if (pageAccess !== undefined && pageAccess !== null) {
            if (typeof pageAccess === "boolean") {
              // Cookie format: { "/path": true }
              return pageAccess;
            }
            // API format: { "/path": { "ADMIN": true } }
            return pageAccess[role] === true;
          }
          // If no permission rule exists, default to false for non-superadmins
          return role === "SUPER_ADMIN";
        });

        if (filteredItems.length === 0) {
          return null;
        }

        return {
          ...section,
          items: filteredItems,
        };
      })
      .filter((sec): sec is MenuSection => sec !== null);
  }, [effectiveRole, permissions]);

  // Auto-expand the section matching current route
  useEffect(() => {
    if (pathname === "/") return;
    const activeSec = menuSections.find((sec) =>
      sec.items.some((item) => pathname.startsWith(item.href.split("?")[0].split("#")[0]))
    );
    if (activeSec) {
      setExclusiveSection(activeSec.label);
    }
  }, [pathname, menuSections, setExclusiveSection]);

  const handleLogout = async () => {
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  const roleBadge = ROLE_BADGE[effectiveRole] ?? ROLE_BADGE.USER;

  if (!isMounted) {
    return (
      <aside className="w-64 sm:w-[240px] h-screen sticky top-0 shrink-0 bg-nexus-card border-r border-nexus-border flex flex-col overflow-hidden">
        <div className="h-16 shrink-0 px-5 border-b border-nexus-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#10D078] to-emerald-400 flex items-center justify-center shadow-lg shadow-[#10D078]/25 text-black">
              <IconInfinity size={22} stroke={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-nexus-text tracking-tight leading-none">
                INFINITY VIBEZ
              </span>
              <span className="text-[9px] font-bold text-[#10D078] tracking-widest uppercase mt-0.5">
                CRM PLATFORM
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-3">
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-64 sm:w-[240px] h-screen sticky top-0 shrink-0 bg-nexus-card border-r border-nexus-border flex flex-col overflow-hidden">
      <div className="h-16 shrink-0 px-4 sm:px-5 border-b border-nexus-border flex items-center justify-between">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#10D078] to-emerald-400 flex items-center justify-center shadow-lg shadow-[#10D078]/25 text-black">
            <IconInfinity size={22} stroke={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold text-nexus-text tracking-tight leading-none">
              INFINITY VIBEZ
            </span>
            <span className="text-[9px] font-bold text-[#10D078] tracking-widest uppercase mt-0.5">
              CRM PLATFORM
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {/* Dashboard */}
        {/* <Link
          href={effectiveRole === "ADMIN" || effectiveRole === "USER" ? "/leads/metrics" : "/dashboard"}
          onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${(effectiveRole === "ADMIN" || effectiveRole === "USER" ? pathname === "/leads/metrics" : pathname === "/dashboard")
            ? "text-[#10D078] bg-[#10D078]/10"
            : "text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover"
            }`}
        >
          <IconLayoutDashboard size={18} />
          <span className="hidden sm:inline">Dashboard</span>
          <span className="sm:hidden">Dashboard</span>
        </Link> */}

        {/* Collapsible Accordion Sections */}
        {menuSections.map((section) => {
          // If section has only 1 item, render directly as a direct link without dropdown wrapper
          if (section.items.length === 1) {
            const item = section.items[0];
            const hrefBase = item.href.split("?")[0].split("#")[0];
            const isActive = pathname === hrefBase || pathname.startsWith(hrefBase + "/");

            return (
              <div key={section.label} className="pt-1">
                <Link
                  href={item.href}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${isActive
                    ? "text-[#10D078] bg-[#10D078]/10 font-bold"
                    : "text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover"
                    }`}
                >
                  {section.icon}
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          }

          const isExpanded = !!expandedSections[section.label];
          const isSectionActive = section.items.some((item) =>
            pathname.startsWith(item.href.split("?")[0].split("#")[0])
          );

          return (
            <div key={section.label} className="pt-1">
              {/* Section Header */}
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wider transition-colors ${isSectionActive
                  ? "text-[#10D078]"
                  : "text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  {section.icon}
                  <span>{section.label}</span>
                </div>
                {isExpanded ? (
                  <IconChevronUp size={14} className="text-nexus-muted" />
                ) : (
                  <IconChevronDown size={14} className="text-nexus-muted" />
                )}
              </button>

              {/* Section Items */}
              {isExpanded && (
                <div className="ml-4 pl-3 border-l border-nexus-border/60 my-1 space-y-0.5">
                  {section.items.map((item) => {
                    const hrefBase = item.href.split("?")[0].split("#")[0];
                    const isActive = pathname === hrefBase || pathname.startsWith(hrefBase + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${isActive
                          ? "text-[#10D078] font-bold bg-[#10D078]/10"
                          : "text-nexus-text hover:bg-nexus-hover"
                          }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Section Dropdown — Profile details and dropdown moved to top header
      {/* 
      <div className="relative px-3 py-4 border-t border-nexus-border">
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-nexus-hover transition-colors text-left focus:outline-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#10D078]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-[#10D078]">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-nexus-text truncate">
                {user?.name || "User"}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-nexus-muted truncate mt-0.5">
                {(user?.company || user?.department) ? (
                  <>
                    <span className="font-semibold text-[#10D078] truncate max-w-[85px]" title={user?.company || user?.department}>
                      {user?.company || user?.department}
                    </span>
                    <span className="text-nexus-muted/40">•</span>
                  </>
                ) : null}
                <span className="capitalize text-nexus-muted font-medium">{roleBadge.label}</span>
              </div>
            </div>
          </div>
          <IconChevronUp size={14} className={`text-nexus-muted transition-transform duration-200 flex-shrink-0 ${showUserDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showUserDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />
            
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-nexus-card border border-nexus-border rounded-xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3 pb-3 border-b border-nexus-border/50">
                <div className="w-10 h-10 rounded-full bg-[#10D078]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-[#10D078]">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-nexus-text truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] text-nexus-muted truncate">
                    {user?.email || ""}
                  </p>
                  {(user?.company || user?.department) && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-[#10D078] truncate">
                      <IconBuildingCommunity size={12} className="flex-shrink-0 text-[#10D078]" />
                      <span className="truncate">{user?.company || user?.department}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                      {user?.role === "SUPER_ADMIN" && <IconCrown size={8} />}
                      {user?.role === "ADMIN" && <IconUserShield size={8} />}
                      {user?.role === "USER" && <IconUsers size={8} />}
                      {roleBadge.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Link
                  href="/settings/security"
                  onClick={() => setShowUserDropdown(false)}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-semibold text-nexus-text hover:bg-nexus-hover transition-colors"
                >
                  <IconKey size={14} className="text-nexus-primary" />
                  <span>Change Password</span>
                </Link>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors text-left focus:outline-none"
                >
                  <IconLogout size={14} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </>
        )}
      */}
    </aside>
  );
}
