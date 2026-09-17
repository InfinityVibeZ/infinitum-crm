import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const where: any = {};

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    const offers = await prisma.offer.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(offers);
  } catch (error) {
    console.error("GET /api/offers error:", error);

    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      title,
      description,
      content,
      status,
      created_by,
    } = body;

    const offerTitle = title ?? name;

    if (!offerTitle) {
      return NextResponse.json(
        { error: "Offer title is required" },
        { status: 400 }
      );
    }

    const offer = await prisma.offer.create({
      data: {
        title: offerTitle,
        description: description || null,
        content:
          content === null || content === undefined
            ? undefined
            : content,
        status: status || "ACTIVE",
        created_by: created_by || null,
      },
    });

    return NextResponse.json(
      offer,
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/offers error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Failed to create offer",
      },
      { status: 500 }
    );
  }
}