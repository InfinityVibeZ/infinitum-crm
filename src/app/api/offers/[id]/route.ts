import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
    });
    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }
    return NextResponse.json(offer);
  } catch (error) {
    console.error("GET /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch offer" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, price, description, category, status, features, isBookmarked } = body;

    const offer = await prisma.offer.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price: parseFloat(price.toString()) }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(status && { status }),
        ...(features !== undefined && { features }),
        ...(isBookmarked !== undefined && { isBookmarked }),
      },
    });

    return NextResponse.json(offer);
  } catch (error: any) {
    console.error("PUT /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update offer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (body.action === "TOGGLE_BOOKMARK") {
      const current = await prisma.offer.findUnique({
        where: { id: params.id },
        select: { isBookmarked: true },
      });
      const offer = await prisma.offer.update({
        where: { id: params.id },
        data: { isBookmarked: !current?.isBookmarked },
      });
      return NextResponse.json(offer);
    }

    if (body.action === "DUPLICATE") {
      const original = await prisma.offer.findUnique({
        where: { id: params.id },
      });
      if (!original) {
        return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      }
      const duplicate = await prisma.offer.create({
        data: {
          name: `${original.name} (Copy)`,
          price: original.price,
          category: original.category,
          status: original.status,
          description: original.description,
          features: original.features || [],
        },
      });
      return NextResponse.json(duplicate, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update offer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.offer.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete offer" },
      { status: 500 }
    );
  }
}
