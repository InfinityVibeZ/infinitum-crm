import { create } from "zustand";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  company?: string;
  companyId?: string;
  department?: string;
  status?: string;
  isActive?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  fetchCurrentUser: () => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  setAuth: (user, token) => {
    const cleanUser = user?.role === "SUPER_ADMIN"
      ? { ...user, company: "", department: "", category: "" }
      : user;

    if (typeof window !== "undefined") {
      localStorage.setItem("nexus-token", token);
      localStorage.setItem("nexus-user", JSON.stringify(cleanUser));
      // Do NOT set nexus-token via document.cookie here — the login API route already
      // sets it as an httpOnly cookie. Re-setting it client-side would silently replace
      // that httpOnly cookie with a JS-readable one, defeating XSS protection on the JWT.
    }
    set({ user: cleanUser, token, isLoading: false });
  },
  fetchCurrentUser: async () => {
    const token = get().token || (typeof window !== "undefined" ? localStorage.getItem("nexus-token") : null);
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403 || res.status === 401) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || data.error || "You don't have access to this portal or application. Please contact the Infinitum team.";
        await get().logout();
        if (typeof window !== "undefined") {
          sessionStorage.setItem("nexus-login-error", msg);
          window.location.href = "/login";
        }
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          get().setAuth(data.user, token);
        }
      }
    } catch (_) {} finally {
      set({ isLoading: false });
    }
  },
  logout: async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("nexus-token");
      localStorage.removeItem("nexus-user");
      // Clear client-side permission, role, and token cookies
      document.cookie = "nexus-token=; Max-Age=0; path=/";
      document.cookie = "nexus-role=; Max-Age=0; path=/";
      document.cookie = "nexus-role-permissions=; Max-Age=0; path=/";
    }
    // Await server-side cookie clear before redirecting
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (_) {}
    set({ user: null, token: null, isLoading: false });
  },
  setLoading: (loading) => set({ isLoading: loading }),
}));

// Initialize auth state from localStorage on client side
if (typeof window !== "undefined") {
  const token = localStorage.getItem("nexus-token");
  const userStr = localStorage.getItem("nexus-user");
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      useAuthStore.getState().setAuth(user, token);
      useAuthStore.getState().fetchCurrentUser();
    } catch {
      useAuthStore.getState().setLoading(false);
    }
  } else {
    useAuthStore.getState().setLoading(false);
  }
}
