"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const IDLE_TIMEOUT_MS = (process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ? parseInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES) : 30) * 60 * 1000;

export function IdleTimerGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, user } = useAuthStore();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(true);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = useCallback(async () => {
    setIsAuthenticated(false);
    await logout();
    window.location.replace("/login");
  }, [logout]);

  const resetTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    // Only set timer if user is logged in
    if (user) {
      idleTimerRef.current = setTimeout(() => {
        performLogout();
      }, IDLE_TIMEOUT_MS);
    }
  }, [user, performLogout]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. BroadcastChannel for Multi-tab logout sync
    const channel = new BroadcastChannel("nexus-auth");
    channel.onmessage = (event) => {
      if (event.data === "LOGOUT") {
        setIsAuthenticated(false);
        // We only redirect here, assuming the other tab already hit the server logout
        window.location.replace("/login");
      }
    };

    // We no longer patch logout here to avoid infinite loops. 
    // BroadcastChannel postMessage is now directly in store/auth.ts

    // 2. Inactivity tracking
    const events = ["mousemove", "keydown", "wheel", "touchstart", "click"];
    const handleActivity = () => {
      // Throttle resetting the timer slightly if needed, but for now just call it
      resetTimer();
    };

    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    resetTimer();

    // 3. BFCache back/forward browser button navigation
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        if (!document.cookie.includes("nexus-refresh-token") && !localStorage.getItem("nexus-user")) {
          setIsAuthenticated(false);
          window.location.replace("/login");
        } else {
          resetTimer();
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      channel.close();
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [pathname, resetTimer, user]);

  if (isAuthenticated === false) {
    return (
      <div className="flex items-center justify-center h-screen bg-nexus-bg">
        <div className="w-6 h-6 border-2 border-[#10D078] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
