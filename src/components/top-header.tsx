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
  ADMIN: { label: "Admin", color: "text-orange-400 bg-orange-500/10 border-orange-500/25" },
  USER: { label: "User", color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
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
      } catch (e) { }
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
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-extrabold text-nexus-text tracking-tight truncate max-w-[150px] sm:max-w-xs">
              {effectiveUser?.company}
            </h2>
            {(effectiveUser?.planName || (effectiveUser as any)?.subscription?.name || (effectiveUser as any)?.plan) && (
              <span className="text-[9px] sm:text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-md uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {effectiveUser?.planName || (effectiveUser as any)?.subscription?.name || (effectiveUser as any)?.plan}
              </span>
            )}
          </div>
          <p className={`text-[10px] sm:text-[11px] font-bold mt-0.5 ${roleBadge.color.replace('bg-', 'text-').replace('/10', '').replace('border-', 'text-')}`}>
            {effectiveUser?.isOwner && effectiveUser.role === "ADMIN" ? "Admin / Owner" : roleBadge.label}
          </p>
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
