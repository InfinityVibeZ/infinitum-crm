import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reports = await prisma.eodReport.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reports);
  } catch (error) {
    console.error("GET /api/team/daily-reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily reports" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repName, role, outreachSent, callsBooked, wins, blockers } = body;

    if (!repName) {
      return NextResponse.json(
        { error: "Rep name is required" },
        { status: 400 }
      );
    }

    const report = await prisma.eodReport.create({
      data: {
        repName,
        role: role || "Setter",
        outreachSent: outreachSent ? parseInt(outreachSent, 10) : 0,
        callsBooked: callsBooked ? parseInt(callsBooked, 10) : 0,
        wins: wins || null,
        blockers: blockers || null,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/team/daily-reports error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit report" },
      { status: 500 }
    );
  }
}
