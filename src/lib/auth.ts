import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing");
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  companyId?: string;
  permissions?: Record<string, boolean>;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: Role = "USER",
  createdBy?: string
) {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user (passwordHash only — plaintext passwords are never stored)
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
      createdBy,
    },
  });

  // Generate JWT
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name || user.email,
    companyId: user.companyId || undefined,
  });

  return { user, token };
}

export async function loginUser(email: string, password: string) {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { companyRef: true },
  });
  if (!user) {
    throw new Error("This email does not exist.");
  }

  const userCompName = user.company || user.companyRef?.name || user.department || "Infinity Vibez";
  const targetTeam = user.role === "USER" ? userCompName : "Infinity Vibez";

  if (!user.isActive || user.status === "INACTIVE") {
    throw new Error(`You don't have access to this portal or application. Please contact the ${targetTeam} team.`);
  }

  if (user.status === "PENDING") {
    throw new Error("This account hasn't been activated yet. Please check your email for the activation link.");
  }

  // Check if company is deactivated (unless Super Admin)
  if (user.role !== "SUPER_ADMIN") {
    const compId = user.companyId || user.companyRef?.id;
    const compName = user.company || user.department;

    if (user.companyRef) {
      if (!user.companyRef.isActive || user.companyRef.status === "INACTIVE") {
        throw new Error("You don't have access to this portal or application. Please contact the Infinity Vibez team.");
      }
    } else if (compId || compName) {
      const company = await prisma.company.findFirst({
        where: {
          OR: [
            compId ? { id: compId } : undefined,
            compName ? { name: { equals: compName, mode: "insensitive" } } : undefined,
          ].filter(Boolean) as any,
        },
      });

      if (company && (!company.isActive || company.status === "INACTIVE")) {
        throw new Error("You don't have access to this portal or application. Please contact the Infinity Vibez team.");
      }
    }
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Password is invalid.");
  }

  // Update last login
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Generate JWT
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name || user.email,
  };
  const token = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { user: updatedUser, token, refreshToken };
}

export function generateToken(payload: JWTPayload): string {
  return generateAccessToken(payload);
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function generateRefreshToken(payload: JWTPayload): string {
  const randomJti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti: randomJti }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/** Utility: get current user from request headers (JWT in cookie or Authorization) */
export function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token !== "null" && token !== "undefined" && token !== "") {
      return token;
    }
  }

  // Parse cookies from headers
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map(c => {
        const [k, v] = c.split("=");
        return [k, decodeURIComponent(v)];
      })
    );
    if (cookies["nexus-access-token"]) {
      return cookies["nexus-access-token"];
    }
    if (cookies["nexus-token"]) {
      return cookies["nexus-token"];
    }
  }

  return null;
}

/** Utility: decode and return payload */
export function getTokenPayload(token: string): JWTPayload | null {
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

/** RLS Helper: Get Prisma `where` clause for entity tables (Leads, Deals, Documents, etc.) based on tenant logic. */
export function getTenantWhereClause(payload: JWTPayload | null) {
  if (!payload) return { id: "UNAUTHORIZED" }; // Failsafe

  if (payload.role === "SUPER_ADMIN") {
    return {}; 
  }

  if (payload.role === "ADMIN") {
    if (payload.companyId) {
      return { companyId: payload.companyId };
    }
    return {
      OR: [
        { userId: payload.userId },
        { user: { createdBy: payload.userId } }
      ]
    };
  }

  // Regular USER sees only their own data
  return { userId: payload.userId };
}

/** RLS Helper (Async): Get Prisma `where` clause for entity tables based on company-wide tenant logic. */
export async function getTenantWhereClauseAsync(payload: JWTPayload | null) {
  if (!payload) return { id: "UNAUTHORIZED" }; // Failsafe

  if (payload.role === "SUPER_ADMIN") {
    return {}; 
  }

  if (payload.role === "ADMIN") {
    if (payload.companyId) {
      return { companyId: payload.companyId };
    }
    const adminUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, company: true, companyId: true, department: true }
    });

    const companyId = adminUser?.companyId;
    const companyName = adminUser?.company || adminUser?.department;

    const orConditions: any[] = [
      { userId: payload.userId },
      { user: { createdBy: payload.userId } }
    ];

    if (companyId) {
      orConditions.push({ user: { companyId } });
      orConditions.push({ companyId });
    }
    // DEPRECATED: fuzzy string matching fallback removed for strict tenant isolation

    return { OR: orConditions };
  }

  // Regular USER sees only their own data
  return { userId: payload.userId };
}

/** RLS Helper: Get Prisma `where` clause for the User table itself. */
export function getUserTenantWhereClause(payload: JWTPayload | null) {
  if (!payload) return { id: "UNAUTHORIZED" }; // Failsafe

  if (payload.role === "SUPER_ADMIN") {
    return {}; // Super Admin sees all users
  }

  if (payload.role === "ADMIN") {
    // Admin sees themselves, and users they created
    return {
      OR: [
        { id: payload.userId },
        { createdBy: payload.userId }
      ]
    };
  }

  // Regular USER sees only themselves
  return { id: payload.userId };
}

/** RLS Helper (Async): Get Prisma `where` clause for the User table itself based on company scope. */
export async function getUserTenantWhereClauseAsync(payload: JWTPayload | null) {
  if (!payload) return { id: "UNAUTHORIZED" }; // Failsafe

  if (payload.role === "SUPER_ADMIN") {
    return {}; // Super Admin sees all users
  }

  if (payload.role === "ADMIN") {
    const adminUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, company: true, companyId: true, department: true }
    });

    const companyId = adminUser?.companyId;
    const companyName = adminUser?.company || adminUser?.department;

    const orConditions: any[] = [
      { id: payload.userId },
      { createdBy: payload.userId }
    ];

    if (companyId) {
      orConditions.push({ companyId });
    }
    // DEPRECATED: fuzzy string matching fallback removed for strict tenant isolation

    return { OR: orConditions };
  }

  // Regular USER sees only themselves
  return { id: payload.userId };
}

/** Utility: check if a role is allowed. Returns an error Response or null if OK. */
export function requireRole(
  userRole: string,
  allowedRoles: Role[]
): Response | null {
  if (!allowedRoles.includes(userRole as Role)) {
    return new Response(
      JSON.stringify({ error: "Insufficient permissions" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}
/**
 * Global authentication and authorization guard.
 * Extracts token, verifies it, loads the User and Company from the database,
 * and ensures they are both ACTIVE. Returns a 401 Response if inactive.
 * Optionally checks if the user's role is within allowedRoles, returning 403 if not.
 */
export async function requireAuthenticatedUser(
  request: Request,
  allowedRoles?: Role[]
): Promise<{ user: any; payload: JWTPayload } | Response> {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = getTokenPayload(token);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { companyRef: true },
  });

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!user.isActive || user.status === "INACTIVE") {
    return new Response(JSON.stringify({ error: "Account deactivated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (user.role !== "SUPER_ADMIN") {
    const compId = user.companyId || user.companyRef?.id;
    const compName = user.company || user.department;

    if (user.companyRef) {
      if (!user.companyRef.isActive || user.companyRef.status === "INACTIVE") {
        return new Response(JSON.stringify({ error: "Company deactivated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else if (compId || compName) {
      const company = await prisma.company.findFirst({
        where: {
          OR: [
            compId ? { id: compId } : undefined,
            compName ? { name: { equals: compName, mode: "insensitive" } } : undefined,
          ].filter(Boolean) as any,
        },
      });

      if (company && (!company.isActive || company.status === "INACTIVE")) {
        return new Response(JSON.stringify({ error: "Company deactivated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role as Role)) {
    return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return { user, payload };
}
