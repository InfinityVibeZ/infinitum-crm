"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconBuildingCommunity,
  IconChevronDown,
  IconCrown,
  IconUserShield,
  IconUsers,
  IconKey,
  IconLogout,
} from "@tabler/icons-react";
import { useAuthStore } from "@/store/auth";

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "text-red-400 bg-red-500/10 border-red-500/25" },
  ADMIN:       { label: "Admin",       color: "text-orange-400 bg-orange-500/10 border-orange-500/25" },
  USER:        { label: "User",        color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
};

interface TopHeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function TopHeader({ onMenuClick, showMenuButton }: TopHeaderProps = {}) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveUser = useMemo(() => {
    let u = user;
    if (!u && typeof window !== "undefined") {
      try {
        const userStr = localStorage.getItem("nexus-user");
        if (userStr) u = JSON.parse(userStr);
      } catch (e) {}
    }
    if (u?.role === "SUPER_ADMIN") {
      return { ...u, company: "", department: "", category: "" };
    }
    return u;
  }, [user]);

  const isSuperAdmin = effectiveUser?.role === "SUPER_ADMIN";
  const companyName = isSuperAdmin ? "Super Admin Workspace" : (effectiveUser?.company || effectiveUser?.department || "Company Workspace");
  const roleBadge = ROLE_BADGE[effectiveUser?.role ?? "USER"] ?? ROLE_BADGE.USER;

  const handleLogout = async () => {
    setShowDropdown(false);
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  if (!isMounted) {
    return (
      <header className="sticky top-0 z-30 h-16 bg-nexus-card border-b border-nexus-border px-6 flex items-center justify-between shadow-sm">
        <div className="h-5 w-36 bg-nexus-hover/50 rounded animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-nexus-hover/50 animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-nexus-card border-b border-nexus-border px-3 sm:px-6 flex items-center justify-between shadow-sm">
      {/* LEFT SIDE: Menu Button (Mobile) + Company Name & Category */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-nexus-hover rounded-lg transition-colors flex-shrink-0"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          {!isSuperAdmin && (
            <>
              <h2 className="text-sm sm:text-base font-extrabold text-nexus-text tracking-tight truncate">
                {effectiveUser?.company || effectiveUser?.department || "Company Workspace"}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-[#10D078] font-bold mt-0.5">
                {(effectiveUser as any)?.category || "General"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Login Details & Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-nexus-hover transition-all border border-transparent hover:border-nexus-border focus:outline-none"
        >
          <div className="w-8 h-8 rounded-full bg-[#10D078]/20 border border-[#10D078]/40 flex items-center justify-center text-xs font-extrabold text-[#10D078] flex-shrink-0 shadow-inner">
            {effectiveUser?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-nexus-text leading-tight truncate max-w-[140px]">
              {effectiveUser?.name || "User"}
            </p>
            <p className="text-[10px] text-nexus-muted font-medium capitalize">
              {roleBadge.label}
            </p>
          </div>
          <IconChevronDown size={14} className={`text-nexus-muted transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown Menu Popup */}
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 mt-2 w-64 bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* User Profile Details */}
              <div className="flex items-center gap-3 pb-3.5 border-b border-nexus-border">
                <div className="w-10 h-10 rounded-full bg-[#10D078]/20 border border-[#10D078]/30 flex items-center justify-center text-sm font-bold text-[#10D078] flex-shrink-0">
                  {effectiveUser?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-nexus-text truncate">
                    {effectiveUser?.name || "User"}
                  </p>
                  <p className="text-[10px] text-nexus-muted truncate">
                    {effectiveUser?.email || ""}
                  </p>
                  {!isSuperAdmin && (effectiveUser?.company || effectiveUser?.department) && (
                    <p className="text-[10px] text-[#10D078] font-semibold truncate mt-0.5">
                      {effectiveUser?.company || effectiveUser?.department}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                      {effectiveUser?.role === "SUPER_ADMIN" && <IconCrown size={8} />}
                      {effectiveUser?.role === "ADMIN" && <IconUserShield size={8} />}
                      {effectiveUser?.role === "USER" && <IconUsers size={8} />}
                      {roleBadge.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu Options */}
              <div className="pt-2 space-y-1">
                <Link
                  href="/settings/security"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-nexus-text hover:bg-nexus-hover transition-colors"
                >
                  <IconKey size={15} className="text-nexus-primary" />
                  <span>Change Password</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors text-left focus:outline-none"
                >
                  <IconLogout size={15} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
