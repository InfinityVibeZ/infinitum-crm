import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reports = await prisma.eodReport.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error(
      "GET /api/team/daily-reports error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to fetch daily reports",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      repName,
      role,
      outreachSent,
      callsBooked,
      wins,
      blockers,
    } = body;

    if (!repName) {
      return NextResponse.json(
        {
          error: "Rep name is required",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    /*
     * EodReport currently stores the report payload
     * in the existing `content` field.
     */
    const content = JSON.stringify({
      repName,
      role: role || "Setter",
      outreachSent:
        outreachSent !== undefined &&
        outreachSent !== null &&
        outreachSent !== ""
          ? parseInt(String(outreachSent), 10)
          : 0,
      callsBooked:
        callsBooked !== undefined &&
        callsBooked !== null &&
        callsBooked !== ""
          ? parseInt(String(callsBooked), 10)
          : 0,
      wins: wins || null,
      blockers: blockers || null,
    });

    const report = await prisma.eodReport.create({
      data: {
        id: crypto.randomUUID(),
        user_id: String(repName),
        report_date: now,
        content,
        updated_at: now,
      },
    });

    return NextResponse.json(
      report,
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/team/daily-reports error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit report",
      },
      { status: 500 }
    );
  }
}