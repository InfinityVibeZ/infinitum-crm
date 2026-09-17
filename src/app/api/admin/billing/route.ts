import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTokenPayload,
  requireAuthenticatedUser,
  requireRole,
} from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) return auth;

    const { payload } = auth;

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);

    if (roleError) return roleError;

    const billingCustomers = await prisma.billingCustomer.findMany({
      include: {
        company: true,
        billingSubscriptions: true,
      },
    });

    return NextResponse.json(billingCustomers);
  } catch (error: unknown) {
    console.error("Failed to fetch admin billing:", error);

    return NextResponse.json(
      { error: "Failed to fetch billing" },
      { status: 500 }
    );
  }
}