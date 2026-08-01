"use client";

import { PermissionGuard } from "@/components/auth/PermissionGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionGuard roles={["SUPER_ADMIN", "ADMIN"]} redirectTo="/">
      {children}
    </PermissionGuard>
  );
}
