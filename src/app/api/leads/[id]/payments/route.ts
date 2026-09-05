import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, getTenantWhereClauseAsync } from "@/lib/auth";


  const resolvedParams = await params;
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const lead = await prisma.lead.findFirst({ where: { id: resolvedParams.id, ...tenantFilter }, select: { id: true } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const payments = await prisma.leadPayment.findMany({
      where: { leadId: resolvedParams.id },
      orderBy: { paymentDate: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("GET /api/leads/[id]/payments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}


  const resolvedParams = await params;
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await request.json();
    const { amount, paymentDate, paymentMethod, referenceId, notes } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number greater than 0" },
        { status: 400 }
      );
    }

    if (!paymentDate || !paymentMethod) {
      return NextResponse.json(
        { error: "Payment Date and Payment Method are required" },
        { status: 400 }
      );
    }

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const lead = await prisma.lead.findFirst({
      where: { id: resolvedParams.id, ...tenantFilter },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const payment = await prisma.leadPayment.create({
      data: {
        leadId: resolvedParams.id,
        amount: numAmount,
        paymentDate: new Date(paymentDate),
        paymentMethod,
        referenceId: referenceId || null,
        notes: notes || null,
        status: status || "PAID",
        createdBy: payload.userId,
        companyId: payload.companyId as string,
      },
    });

    // Update cashCollected on lead if applicable
    const validPayments = await prisma.leadPayment.aggregate({
      where: { leadId: resolvedParams.id, status: "PAID" },
      _sum: { amount: true },
    });
    const totalPaid = validPayments._sum.amount ? parseFloat(validPayments._sum.amount.toString()) : 0;

    await prisma.lead.update({
      where: { id: resolvedParams.id },
      data: { cashCollected: totalPaid },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("POST /api/leads/[id]/payments error:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
