"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

/**
 * Settings/Team page — redirects ADMIN and SUPER_ADMIN to the full
 * User Management page, keeps a simple readonly view for USER role.
 */
export default function SettingsTeamPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") {
      router.replace("/admin/user-management");
    }
  }, [user?.role, router]);

  // Regular users see a read-only team view
  if (user?.role === "USER" || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-nexus-primary/10 flex items-center justify-center text-3xl">
          👥
        </div>
        <div>
          <h2 className="text-lg font-bold text-nexus-text">Team Management</h2>
          <p className="text-sm text-nexus-text-secondary mt-1">
            Contact your administrator to manage team members.
          </p>
        </div>
      </div>
    );
  }

  return null; // redirecting
}
