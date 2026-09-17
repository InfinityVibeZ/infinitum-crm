import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    
    // Only admins can manage team memberships
    if (!user || !user.companyId || user.role === "USER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userIds } = await req.json();
    if (!Array.isArray(userIds)) {
      return NextResponse.json({ error: "userIds must be an array" }, { status: 400 });
    }

    // Verify team exists and belongs to the company
    const team = await prisma.team.findFirst({
      where: {
        id: params.id,
        companyId: user.companyId
      }
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Verify all users belong to the current company (tenant isolation check)
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        companyId: user.companyId
      },
      select: { id: true }
    });

    if (validUsers.length !== userIds.length) {
      return NextResponse.json({ error: "One or more users are invalid or belong to another company" }, { status: 400 });
    }

    // Replace members using transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing
      await tx.userTeam.deleteMany({
        where: { teamId: params.id }
      });

      // Insert new
      if (validUsers.length > 0) {
        await tx.userTeam.createMany({
          data: validUsers.map((u) => ({
            userId: u.id,
            teamId: params.id,
            companyId: user.companyId
          }))
        });
      }
    });

    // Return the updated team with its members
    const updatedTeam = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    console.error("Team members PUT API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
