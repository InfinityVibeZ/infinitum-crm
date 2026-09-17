"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

export function Global401Interceptor() {
  const { logout } = useAuthStore();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);
        
        // Exclude refresh endpoint itself from interception
        const isRefreshCall = args[0] === "/api/auth/refresh";
        
        if (response.status === 401 && !isRefreshCall) {
          if (isRefreshing) {
            // Queue the request
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            }).then(() => {
              return originalFetch.apply(this, args);
            }).catch((err) => {
              return Promise.reject(err);
            });
          }

          isRefreshing = true;

          try {
            const refreshRes = await originalFetch("/api/auth/refresh", { method: "POST" });
            if (refreshRes.ok) {
              isRefreshing = false;
              processQueue(null);
              // Retry the original request
              return originalFetch.apply(this, args);
            } else {
              throw new Error("Refresh failed");
            }
          } catch (err) {
            isRefreshing = false;
            processQueue(err as Error);
            await logout();
            if (window.location.pathname !== "/login") {
              window.location.replace("/login");
            }
            return response;
          }
        }
        
        return response;
      } catch (error) {
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  return null;
}
