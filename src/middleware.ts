import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDefaultPermissionsForRole } from "@/lib/permissions";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing");
}

function base64UrlToBytes(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeToString(base64Url: string): string {
  const bytes = base64UrlToBytes(base64Url);
  return new TextDecoder().decode(bytes);
}

/**
 * Verifies a HS256 JWT's signature using the Web Crypto API (available in the Edge runtime,
 * unlike Node's `jsonwebtoken`/`crypto`). Returns the decoded payload only if the signature
 * is valid and the token isn't expired — never trust an unverified decode for authorization.
 */
async function verifyJwtEdge(
  token: string,
  secret: string,
): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToBytes(signatureB64);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as BufferSource,
      data as BufferSource,
    );
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecodeToString(payloadB64));
    if (typeof payload.exp === "number" && Date.now() >= payload.exp * 1000)
      return null;

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = [
    "/login",
    "/reset-password",
    "/account/setup",
    "/access-denied",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/setup-account",
    "/api/auth/logout",
    "/api/cron",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );

  const isPublicRegistration =
    pathname === "/register" ||
    (pathname === "/api/users" && request.method === "POST");

  if (isPublicRoute || isPublicRegistration) {
    return NextResponse.next();
  }

  // Check for auth token in cookie or Authorization header
  const token =
    request.cookies.get("nexus-token")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify JWT signature (Edge-compatible) before trusting its role claim for any decision
  const payload = await verifyJwtEdge(token, JWT_SECRET);
  if (!payload) {
    const response = pathname.startsWith("/api")
      ? NextResponse.json({ error: "Invalid token" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    return response;
  }

  const userRole = payload.role;

  // Prevent Super Admin lockout of the permissions configuration routes
  const isPermissionsRoute =
    pathname.startsWith("/admin/permissions") ||
    pathname.startsWith("/api/settings/permissions");
  if (isPermissionsRoute && userRole === "SUPER_ADMIN") {
    return NextResponse.next();
  }

  // Allow all authenticated roles to access their own Change Password / security page
  if (
    pathname.startsWith("/settings/security") ||
    pathname.startsWith("/api/users/change-password")
  ) {
    return NextResponse.next();
  }

  // 1. Static Restricted Routes for Non-Super Admins
  //
  // Note: "/api/settings/permissions" (GET) is intentionally NOT listed here — the sidebar
  // needs it to build every role's menu, and the actual mutation (POST) is separately gated
  // by requireRole(["SUPER_ADMIN"]) inside the route handler. Only the admin PAGE at
  // "/admin/permissions" is Super-Admin-only.
  const superAdminOnlyRoutes = [
    "/admin/admin-management",
    "/admin/permissions",
    "/settings/api-keys",
    "/api/settings/api-keys",
  ];
  const isSuperAdminOnly = superAdminOnlyRoutes.some((route) =>
    pathname.startsWith(route),
  );
  if (isSuperAdminOnly && userRole !== "SUPER_ADMIN") {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin access required" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(
      new URL(
        `/access-denied?path=${encodeURIComponent(pathname)}`,
        request.url,
      ),
    );
  }

  // 2. Dynamic Path-based Permissions Check
  //
  // SECURITY: permissions come from `payload.permissions`, a claim embedded in the JWT at
  // login time (see /api/auth/login) — it is part of the signed token, so it's tamper-proof
  // (verified above via verifyJwtEdge). We deliberately do NOT read the `nexus-role-permissions`
  // cookie here: that cookie is plain (non-httpOnly) so the sidebar can read it client-side for
  // menu rendering, which also means it's trivially editable via devtools and must never be
  // trusted for an authorization decision. If a token predates this claim (or the login-time
  // DB fetch failed), fall back to the hardcoded per-role defaults.
  const permissions: Record<string, boolean> =
    payload.permissions && typeof payload.permissions === "object"
      ? payload.permissions
      : getDefaultPermissionsForRole(userRole);

  // Direct page path match or sub-path match
  const configPaths = Object.keys(permissions).sort(
    (a, b) => b.length - a.length,
  );
  const matchedPath = configPaths.find(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );

  if (matchedPath) {
    const isAllowed = permissions[matchedPath];
    if (!isAllowed) {
      return NextResponse.redirect(
        new URL(
          `/access-denied?path=${encodeURIComponent(pathname)}`,
          request.url,
        ),
      );
    }
  }

  // API endpoints check
  //
  // Note on /api/users: GET behaves differently per role — SUPER_ADMIN/ADMIN get the full
  // User Management view (correctly gated by the "/admin/user-management" page permission),
  // but a USER caller gets a safe, company-scoped team roster (used by dashboards/assignee
  // pickers), which isn't the "User Management" admin feature at all. Mutating actions
  // (POST/PATCH/DELETE) are separately enforced inside each route handler via requireRole,
  // so it's safe to exempt USER role from this page-permission gate here.
  //
  // Note on /api/settings/permissions: GET just returns the permission matrix used by the
  // sidebar to build EVERY role's menu (including Admin/User) — it's not the "Permissions"
  // admin feature itself. Only POST mutates it, and that's separately gated by
  // requireRole(["SUPER_ADMIN"]) in the route handler, so this endpoint is intentionally not
  // mapped to the "/admin/permissions" page permission here.
  let matchedPagePath: string | null = null;
  if (pathname.startsWith("/api/leads")) matchedPagePath = "/leads/crm";
  else if (pathname.startsWith("/api/deals"))
    matchedPagePath = "/sales/pipeline";
  else if (pathname.startsWith("/api/offers"))
    matchedPagePath = "/offer/creation";
  else if (pathname.startsWith("/api/documents"))
    matchedPagePath = "/documents/proposals";
  else if (pathname.startsWith("/api/settings/api-keys"))
    matchedPagePath = "/settings/api-keys";
  else if (pathname.startsWith("/api/audit-logs"))
    matchedPagePath = "/admin/audit-logs";
  else if (pathname.startsWith("/api/users") && userRole !== "USER")
    matchedPagePath = "/admin/user-management";

  if (matchedPagePath) {
    const isAllowed = permissions[matchedPagePath];
    if (isAllowed === false) {
      return NextResponse.json(
        {
          error: `Forbidden: Access to ${matchedPagePath} is disabled for your role.`,
        },
        { status: 403 },
      );
    }
  }

  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
