import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
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
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name || user.email,
  });

  return { user: updatedUser, token };
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/** Utility: get current user from request headers (JWT in cookie or Authorization) */
export function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
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
    return {}; // Super Admin sees all
  }

  if (payload.role === "ADMIN") {
    // Admin sees their own data, and data of users they created
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
    return {}; // Super Admin sees all
  }

  if (payload.role === "ADMIN") {
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
    }

    if (companyName && companyName.trim() !== "") {
      orConditions.push({ user: { company: { equals: companyName, mode: "insensitive" } } });
      orConditions.push({ company: { equals: companyName, mode: "insensitive" } });
    }

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

    if (companyName && companyName.trim() !== "") {
      orConditions.push({ company: { equals: companyName, mode: "insensitive" } });
      orConditions.push({ department: { equals: companyName, mode: "insensitive" } });
    }

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
