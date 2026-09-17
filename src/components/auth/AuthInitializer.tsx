"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";

export function AuthInitializer() {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      const userStr = localStorage.getItem("nexus-user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          useAuthStore.getState().setAuth(user, "");
        } catch {}
      }

      // Only fetch if they have a role cookie, otherwise they are definitely logged out
      if (document.cookie.includes("nexus-role=")) {
        useAuthStore.getState().fetchCurrentUser();
      } else {
        useAuthStore.getState().setLoading(false);
      }
    }
  }, []);

  return null;
}
