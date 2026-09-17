import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";
import { AssignmentStrategy } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const rules = await prisma.leadAssignmentRule.findMany({
      where: { companyId: user.companyId },
      orderBy: { priority: "asc" }
    });

    return NextResponse.json(rules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId || user.role === "USER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, priority, strategy, targetUserId, targetTeamId, enabled } = body;

    if (!name || priority === undefined || !strategy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify strategy enum
    if (!Object.values(AssignmentStrategy).includes(strategy)) {
      return NextResponse.json({ error: "Invalid strategy" }, { status: 400 });
    }

    const rule = await prisma.leadAssignmentRule.create({
      data: {
        companyId: user.companyId,
        name,
        description,
        priority: parseInt(priority, 10),
        strategy,
        targetUserId,
        targetTeamId,
        enabled: enabled !== undefined ? enabled : true,
      }
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
