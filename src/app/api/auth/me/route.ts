import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireAuthenticatedUser } from "@/lib/auth";
import { touchSession } from "@/lib/session-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const payload = getTokenPayload(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isActive: true,
        company: true,
        companyId: true,
        department: true,
        category: true,
        phone: true,
        companyRef: { select: { id: true, name: true, category: true, isActive: true, status: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check user & company active status for non SUPER_ADMIN
    if (user.role !== "SUPER_ADMIN") {
      let isCompDeactivated = false;
      const compId = user.companyId || user.companyRef?.id;
      const compName = user.company || user.department;

      if (user.companyRef) {
        if (!user.companyRef.isActive || user.companyRef.status === "INACTIVE") {
          isCompDeactivated = true;
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
          isCompDeactivated = true;
        }
      }

      const userCompName = user.company || user.companyRef?.name || user.department || "Infinity Vibez";
      const targetTeamName = (isCompDeactivated || user.role !== "USER") ? "Infinity Vibez" : userCompName;

      if (isCompDeactivated || !user.isActive || user.status === "INACTIVE") {
        return NextResponse.json(
          {
            error: "DEACTIVATED",
          },
          { status: 401 }
        );
      }
    }

    const isSuper = user.role === "SUPER_ADMIN";
    const companyName = user.company || user.companyRef?.name || user.department || "";
    const companyIdVal = user.companyId || user.companyRef?.id || "";
    const categoryVal = user.category || user.companyRef?.category || "";

    let planName = "";
    let isOwner = false;

    if (companyIdVal) {
      const company = await prisma.company.findUnique({
        where: { id: companyIdVal },
      });

      if (company) {
        if (company.ownerUserId === user.id) {
          isOwner = true;
        }
      }

      const sub = await prisma.subscription.findUnique({
        where: { companyId: companyIdVal },
        include: { plan: true },
      });
      if (sub && sub.plan) {
        planName = sub.plan.name;
      }
    }

    // Fire-and-forget heartbeat (internally throttled) — this endpoint is polled every
    // 5s by IdleTimerGuard, so we never want it waiting on this write.
    touchSession(user.id).catch((err) => console.error("touchSession failed:", err));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        isOwner: isOwner,
        company: companyName,
        companyId: companyIdVal,
        department: isSuper ? "" : (user.department || companyName),
        category: categoryVal,
        planName: planName,
        phone: user.phone || "",
      },
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ error: "Failed to fetch current user profile" }, { status: 500 });
  }
}
