import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const priceRange = searchParams.get("priceRange");

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category && category !== "ALL") {
      where.category = category;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (priceRange && priceRange !== "ALL") {
      if (priceRange === "UNDER_1K") where.price = { lt: 1000 };
      else if (priceRange === "1K_5K") where.price = { gte: 1000, lte: 5000 };
      else if (priceRange === "5K_10K") where.price = { gte: 5000, lte: 10000 };
      else if (priceRange === "10K_PLUS") where.price = { gte: 10000 };
    }

    const offers = await prisma.offer.findMany({
      where,
      orderBy: [
        { isBookmarked: "desc" },
        { createdAt: "desc" },
      ],
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
    const { name, price, description, category, status, features } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: "Name and Price are required" },
        { status: 400 }
      );
    }

    const offer = await prisma.offer.create({
      data: {
        name,
        price: parseFloat(price.toString()),
        category: category || "Standard",
        status: status || "ACTIVE",
        description: description || null,
        features: Array.isArray(features) ? features : [],
      },
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/offers error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create offer" },
      { status: 500 }
    );
  }
}
