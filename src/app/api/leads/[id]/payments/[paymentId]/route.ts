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

    const body = await request.json();
    const { amount, paymentDate, paymentMethod, referenceId, notes, status } = body;

    const existingPayment = await prisma.leadPayment.findUnique({
      where: { id: resolvedParams.paymentId },
    });

    if (!existingPayment || existingPayment.leadId !== resolvedParams.id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const updated = await prisma.leadPayment.update({
      where: { id: resolvedParams.paymentId },
      data: {
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(paymentDate !== undefined && { paymentDate: new Date(paymentDate) }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(referenceId !== undefined && { referenceId }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && {
          status,
          ...(status === "VOIDED" && { voidedAt: new Date() }),
        }),
      },
    });

    // Recalculate lead cashCollected
    const validPayments = await prisma.leadPayment.aggregate({
      where: { leadId: resolvedParams.id, status: "PAID" },
      _sum: { amount: true },
    });
    const totalPaid = validPayments._sum.amount ? parseFloat(validPayments._sum.amount.toString()) : 0;

    await prisma.lead.update({
      where: { id: resolvedParams.id },
      data: { cashCollected: totalPaid },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT payment error:", error);
    return NextResponse.json(
      { error: "Failed to update payment" },
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

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const lead = await prisma.lead.findFirst({ where: { id: resolvedParams.id, ...tenantFilter }, select: { id: true } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const existingPayment = await prisma.leadPayment.findUnique({
      where: { id: resolvedParams.paymentId },
    });

    if (!existingPayment || existingPayment.leadId !== resolvedParams.id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Prefer Voiding payment over permanent hard deletion
    const voidedPayment = await prisma.leadPayment.update({
      where: { id: resolvedParams.paymentId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
      },
    });

    // Recalculate lead cashCollected
    const validPayments = await prisma.leadPayment.aggregate({
      where: { leadId: resolvedParams.id, status: "PAID" },
      _sum: { amount: true },
    });
    const totalPaid = validPayments._sum.amount ? parseFloat(validPayments._sum.amount.toString()) : 0;

    await prisma.lead.update({
      where: { id: resolvedParams.id },
      data: { cashCollected: totalPaid },
    });

    return NextResponse.json(voidedPayment);
  } catch (error) {
    console.error("DELETE (Void) payment error:", error);
    return NextResponse.json(
      { error: "Failed to void payment" },
      { status: 500 }
    );
  }
}
