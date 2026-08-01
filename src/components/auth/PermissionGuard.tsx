"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import type { Role } from "@prisma/client";
import { AccessDeniedView } from "./AccessDeniedView";

interface PermissionGuardProps {
  /** Roles that are allowed to see this content */
  roles: Role[];
  /** Where to redirect if not permitted (default: "/") */
  redirectTo?: string;
  /** Show nothing (null) instead of showing Access Denied */
  silent?: boolean;
  children: React.ReactNode;
}

/**
 * Wrap any component to restrict access to specific roles.
 * - Unauthenticated users → redirected to /login
 * - Authenticated but wrong role → shows Access Denied page with "Go to Dashboard"
 */
export function PermissionGuard({
  roles,
  redirectTo = "/",
  silent = false,
  children,
}: PermissionGuardProps) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  const userRole = user?.role as Role | undefined;
  const isAuthenticated = !!user;
  const isAllowed = userRole ? roles.includes(userRole) : false;

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const path = typeof window !== "undefined" ? window.location.pathname : "/";
      router.push(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-nexus-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated — show spinner while redirecting to login
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-nexus-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Authenticated but wrong role
  if (!isAllowed) {
    if (silent) return null;

    return <AccessDeniedView onGoBack={() => router.push(redirectTo)} />;
  }

  return <>{children}</>;
}
