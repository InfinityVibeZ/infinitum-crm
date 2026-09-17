import { NextResponse } from "next/server";
import { loginUser, generateAccessToken, requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";
import { mergePermissionsForRole, getDefaultPermissionsForRole } from "@/lib/permissions";
import { MAX_CONCURRENT_USERS, getActiveUserCount, isUserCurrentlyActive, touchSession } from "@/lib/session-limit";

export async function POST(request: Request) {
  console.log("========== LOGIN REQUEST DEBUG ==========");

  console.log("[LOGIN] request.url:", request.url);

  console.log("[LOGIN] headers:", {
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),

    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    forwardedFor: request.headers.get("x-forwarded-for"),

    cfConnectingIp: request.headers.get("cf-connecting-ip"),
    cfVisitor: request.headers.get("cf-visitor"),
    cfRay: request.headers.get("cf-ray"),

    userAgent: request.headers.get("user-agent"),
  });

  const loginRequestUrl = new URL(request.url);

  console.log("[LOGIN] parsed URL:", {
    protocol: loginRequestUrl.protocol,
    hostname: loginRequestUrl.hostname,
    host: loginRequestUrl.host,
    origin: loginRequestUrl.origin,
    pathname: loginRequestUrl.pathname,
  });

  console.log("=========================================");
  const ip = getIpFromRequest(request);

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    let user: any;
    let token: string;
    let refreshToken: string;

    try {
      const result = await loginUser(email, password);
      user = result.user;
      token = result.token;
      refreshToken = result.refreshToken;
    } catch (loginErr) {
      // Log failed login attempt
      await logAuditEvent({
        action: "LOGIN_FAILED",
        category: "Authentication",
        severity: "WARNING",
        actorName: email,
        actorEmail: email,
        actorRole: "UNKNOWN",
        targetName: "Login Portal",
        summary: `Failed login attempt for ${email}`,
        ipAddress: ip,
      });
      const message = loginErr instanceof Error ? loginErr.message : "Login failed";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // Enforce the concurrent-user cap. A user who already has a fresh session
    // (e.g. reloading the login page after already being logged in) is never
    // blocked — only a genuinely NEW user shows up as #101.
    if (!(await isUserCurrentlyActive(user.id))) {
      const activeCount = await getActiveUserCount();
      if (activeCount >= MAX_CONCURRENT_USERS) {
        await logAuditEvent({
          action: "LOGIN_REJECTED_CAPACITY",
          category: "Authentication",
          severity: "WARNING",
          actorName: user.name || email,
          actorEmail: email,
          actorRole: user.role,
          targetName: "Login Portal",
          summary: `Login rejected — server at capacity (${MAX_CONCURRENT_USERS} concurrent users)`,
          ipAddress: ip,
        });
        return NextResponse.json(
          { error: "Server is currently at full capacity. Please try again after some time." },
          { status: 429 }
        );
      }
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        company: true,
        companyId: true,
        department: true,
        category: true,
        phone: true,
        status: true,
        isActive: true,
        companyRef: { select: { id: true, name: true, category: true } },
      },
    });

    const isSuper = user.role === "SUPER_ADMIN";
    const resolvedCompany = userRecord?.company || userRecord?.companyRef?.name || userRecord?.department || user.company || user.department || "";
    const companyIdVal = userRecord?.companyId || userRecord?.companyRef?.id || user.companyId || "";
    const categoryVal = userRecord?.category || userRecord?.companyRef?.category || user.category || "";

    let planName = "";
    let isOwner = false;

    if (companyIdVal) {
      const company = await prisma.company.findUnique({
        where: { id: companyIdVal },
      });
      if (company && company.ownerUserId === user.id) {
        isOwner = true;
      }
      const sub = await prisma.subscription.findUnique({
        where: { companyId: companyIdVal },
        include: { plan: true },
      });
      if (sub && sub.plan) {
        planName = sub.plan.name;
      }
    }

    // Compute effective page permissions (DB customizations merged over hardcoded defaults)
    // and embed them directly in the signed JWT — this is what middleware trusts for
    // page-level authorization, since it's tamper-proof (verified against JWT_SECRET),
    // unlike a plain cookie a user could edit via devtools.
    // Default to the safe hardcoded matrix first — if the DB lookup below fails, the token
    // must still carry SOMETHING (an empty {} would make middleware deny every single page,
    // since a missing/false entry reads as "not allowed").
    let rolePermissions: Record<string, boolean> = getDefaultPermissionsForRole(user.role);
    try {
      const config = await prisma.systemConfig.findUnique({ where: { key: "ROLE_PERMISSIONS" } });
      const dbPerms = config ? JSON.parse(config.value) : null;
      rolePermissions = mergePermissionsForRole(user.role, dbPerms);
    } catch (err) {
      console.error("Failed to fetch role permissions on login:", err);
    }

    token = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name || user.email,
      permissions: rolePermissions,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: userRecord?.status || user.status || "ACTIVE",
        isActive: userRecord?.isActive ?? user.isActive ?? true,
        isOwner: isOwner,
        company: resolvedCompany,
        companyId: companyIdVal,
        department: isSuper ? "" : (user.department || resolvedCompany),
        category: categoryVal,
        planName: planName,
        phone: userRecord?.phone || user.phone || "",
      }
    });
    console.log("[LOGIN] COOKIE ENV:", {
      nodeEnv: process.env.NODE_ENV,
      secureCookie: process.env.NODE_ENV === "production",
      requestUrl: request.url,
    });

    // Set token as httpOnly cookie
    response.cookies.set("nexus-access-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 mins
      path: "/",
    });

    response.cookies.set("nexus-refresh-token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    response.cookies.set("nexus-role", user.role, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    console.log("[LOGIN] cookies configured:", {
      accessTokenCookie: true,
      refreshTokenCookie: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });

    // Cosmetic only — read by the sidebar to render the menu before its own permissions
    // fetch resolves. NOT used for authorization; middleware trusts payload.permissions
    // from the signed JWT instead (see above), never this cookie.
    if (Object.keys(rolePermissions).length > 0) {
      response.cookies.set("nexus-role-permissions", JSON.stringify(rolePermissions), {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
    }

    // Log successful login
    await logAuditEvent({
      action: "USER_LOGIN",
      category: "Authentication",
      severity: "INFO",
      actorName: user.name || user.email,
      actorEmail: user.email,
      actorRole: user.role,
      targetName: "Dashboard",
      summary: `${user.name || user.email} logged into the system`,
      ipAddress: ip,
    });

    await touchSession(user.id);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
