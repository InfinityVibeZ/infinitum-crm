"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export function IdleTimerGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { fetchCurrentUser } = useAuthStore();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const checkAuthToken = useCallback(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("nexus-token");
      if (!token) {
        setIsAuthenticated(false);
        window.location.replace("/login");
        return false;
      }
    }
    setIsAuthenticated(true);
    return true;
  }, []);

  useEffect(() => {
    // 1. Immediate token check on mount/route change
    const valid = checkAuthToken();
    if (valid) {
      fetchCurrentUser();
    }

    // 2. Intercept BFCache back/forward browser button navigation after logout
    const handlePageShow = (event: PageTransitionEvent) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("nexus-token") : null;
      if (event.persisted || !token) {
        if (!token) {
          setIsAuthenticated(false);
          window.location.replace("/login");
        } else {
          fetchCurrentUser();
        }
      }
    };

    const onFocus = () => {
      if (checkAuthToken()) {
        fetchCurrentUser();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", onFocus);

    // 3. Periodic check every 60 seconds to catch logout in another tab or company deactivation
    const interval = setInterval(() => {
      if (checkAuthToken()) {
        fetchCurrentUser();
      } else {
        clearInterval(interval);
      }
    }, 60000);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [pathname, fetchCurrentUser, checkAuthToken]);

  // If token is missing, render spinner while replacing URL to /login
  if (isAuthenticated === false) {
    return (
      <div className="flex items-center justify-center h-screen bg-nexus-bg">
        <div className="w-6 h-6 border-2 border-[#10D078] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
