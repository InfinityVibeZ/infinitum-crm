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
  planName?: string;
  isOwner?: boolean;
}

interface AuthState {
  user: AuthUser | null;

  /**
   * Access token is intentionally NOT stored in localStorage.
   * Authentication is handled by the HttpOnly nexus-access-token cookie.
   *
   * The field is retained in the store for backward compatibility with
   * existing components that may read `token`.
   */
  token: string | null;

  isLoading: boolean;

  setAuth: (
    user: AuthUser,
    token?: string | null
  ) => void;

  fetchCurrentUser: () => Promise<void>;

  logout: () => Promise<void>;

  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,

  token: null,

  isLoading: true,

  /**
   * Set authenticated user in memory.
   *
   * IMPORTANT:
   * No access token is written to localStorage.
   * The real authentication token is HttpOnly and therefore inaccessible
   * to JavaScript.
   */
  setAuth: (user, token = null) => {
    const cleanUser = user;

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "nexus-user",
        JSON.stringify(cleanUser)
      );

      // Remove legacy token storage if it exists.
      localStorage.removeItem("nexus-token");
    }

    set({
      user: cleanUser,
      token: token || null,
      isLoading: false,
    });
  },

  /**
   * Get the current authenticated user from the server.
   *
   * Authentication is determined by the HttpOnly cookie.
   */
  fetchCurrentUser: async () => {
    console.log("[AUTH-STORE] fetchCurrentUser START");

    try {
      let response: Response;
      for (let attempt = 0; ; attempt += 1) {
        response = await fetch(
          "/api/auth/me",
          {
            method: "GET",

            // Explicitly allow same-origin cookies.
            credentials: "same-origin",

            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        // Turbopack can briefly return 404 while compiling a route on the
        // first request in a fresh local dev process.
        if (response.status !== 404 || attempt >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      console.log(
        "[AUTH-STORE] /api/auth/me RESPONSE",
        {
          status: response.status,
          ok: response.ok,
          origin:
            typeof window !== "undefined"
              ? window.location.origin
              : "server",
        }
      );

      if (response.status === 401) {
        console.log(
          "[AUTH-STORE] Session not authenticated"
        );

        /*
         * Do NOT call logout() here.
         *
         * logout() makes another API request and broadcasts a logout event.
         * During initial authentication checks that can create unnecessary
         * redirects/loops.
         */
        if (typeof window !== "undefined") {
          localStorage.removeItem("nexus-user");
          localStorage.removeItem("nexus-token");
        }

        set({
          user: null,
          token: null,
          isLoading: false,
        });

        return;
      }

      if (!response.ok) {
        console.error(
          "[AUTH-STORE] /api/auth/me FAILED",
          {
            status: response.status,
          }
        );

        set({
          isLoading: false,
        });

        return;
      }

      const data = await response.json();

      console.log(
        "[AUTH-STORE] /api/auth/me DATA",
        {
          userPresent: !!data?.user,
          userIdPresent: !!data?.user?.id,
          role: data?.user?.role,
          companyIdPresent: !!data?.user?.companyId,
        }
      );

      if (data?.user) {
        get().setAuth(
          data.user,
          null
        );
      } else {
        set({
          user: null,
          token: null,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error(
        "[AUTH-STORE] fetchCurrentUser ERROR",
        error
      );

      set({
        isLoading: false,
      });
    }
  },

  /**
   * Logout.
   *
   * The server is responsible for clearing/revoking the HttpOnly
   * authentication cookies and sessions.
   */
  logout: async () => {
    console.log(
      "[AUTH-STORE] LOGOUT START"
    );

    if (typeof window !== "undefined") {
      localStorage.removeItem("nexus-user");
      localStorage.removeItem("nexus-token");

      /*
       * These are legacy/client-accessible cookies.
       * HttpOnly authentication cookies cannot be cleared by JS.
       * The server logout endpoint handles those.
       */
      document.cookie =
        "nexus-token=; Max-Age=0; path=/";

      document.cookie =
        "nexus-role=; Max-Age=0; path=/";

      document.cookie =
        "nexus-role-permissions=; Max-Age=0; path=/";
    }

    /*
     * Server-side logout first.
     */
    try {
      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      console.log(
        "[AUTH-STORE] LOGOUT API RESPONSE",
        {
          status: response.status,
          ok: response.ok,
        }
      );
    } catch (error) {
      console.error(
        "[AUTH-STORE] LOGOUT API ERROR",
        error
      );
    }

    /*
     * Broadcast logout to other tabs.
     */
    if (
      typeof window !== "undefined" &&
      typeof BroadcastChannel !== "undefined"
    ) {
      try {
        const channel =
          new BroadcastChannel(
            "nexus-auth"
          );

        channel.postMessage(
          "LOGOUT"
        );

        channel.close();
      } catch (error) {
        console.error(
          "[AUTH-STORE] Broadcast logout failed",
          error
        );
      }
    }

    set({
      user: null,
      token: null,
      isLoading: false,
    });

    console.log(
      "[AUTH-STORE] LOGOUT COMPLETE"
    );
  },

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),
}));