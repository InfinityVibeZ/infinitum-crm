import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantWhereClauseAsync,
  requireAuthenticatedUser,
} from "@/lib/auth";

type PaymentMetadata = {
  paymentMethod?: string | null;
  referenceId?: string | null;
  status?: string | null;
  notes?: string | null;
};

function parsePaymentNotes(notes: string | null): PaymentMetadata {
  if (!notes) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes);

    if (parsed && typeof parsed === "object") {
      return parsed as PaymentMetadata;
    }
  } catch {
    // Existing plain-text notes
  }

  return {
    notes,
  };
}

function buildPaymentNotes(
  paymentMethod: unknown,
  referenceId: unknown,
  status: unknown,
  notes: unknown
): string {
  return JSON.stringify({
    paymentMethod:
      typeof paymentMethod === "string" ? paymentMethod : null,
    referenceId:
      typeof referenceId === "string" ? referenceId : null,
    status: typeof status === "string" ? status : "PAID",
    notes: typeof notes === "string" ? notes : null,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter = await getTenantWhereClauseAsync(payload);

    const lead = await prisma.lead.findFirst({
      where: {
        id: resolvedParams.id,
        ...tenantFilter,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found or unauthorized" },
        { status: 404 }
      );
    }

    const existingPayment = await prisma.leadPayment.findFirst({
      where: {
        id: resolvedParams.paymentId,
        leadId: resolvedParams.id,
        ...(tenantFilter.companyId
          ? { companyId: tenantFilter.companyId }
          : {}),
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      amount,
      paymentDate,
      paymentMethod,
      referenceId,
      notes,
      status,
    } = body;

    const existingMetadata = parsePaymentNotes(existingPayment.notes);

    const newAmount =
      amount !== undefined
        ? Number(amount)
        : Number(existingPayment.amount);

    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be greater than zero" },
        { status: 400 }
      );
    }

    let newPaymentDate = existingPayment.paymentDate;

    if (paymentDate !== undefined) {
      const parsedDate = new Date(paymentDate);

      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid payment date" },
          { status: 400 }
        );
      }

      newPaymentDate = parsedDate;
    }

    const finalPaymentMethod =
      paymentMethod !== undefined
        ? paymentMethod
        : existingMetadata.paymentMethod;

    const finalReferenceId =
      referenceId !== undefined
        ? referenceId
        : existingMetadata.referenceId;

    const finalStatus =
      status !== undefined
        ? status
        : existingMetadata.status || "PAID";

    const finalNotes =
      notes !== undefined
        ? notes
        : existingMetadata.notes ?? null;

    const updated = await prisma.leadPayment.update({
      where: {
        id: resolvedParams.paymentId,
      },
      data: {
        amount: newAmount,
        paymentDate: newPaymentDate,
        notes: buildPaymentNotes(
          finalPaymentMethod,
          finalReferenceId,
          finalStatus,
          finalNotes
        ),
      },
    });

    return NextResponse.json({
      ...updated,
      paymentMethod: finalPaymentMethod || null,
      referenceId: finalReferenceId || null,
      status: finalStatus || "PAID",
      notes: finalNotes || null,
    });
  } catch (error) {
    console.error("PUT payment error:", error);

    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter = await getTenantWhereClauseAsync(payload);

    const lead = await prisma.lead.findFirst({
      where: {
        id: resolvedParams.id,
        ...tenantFilter,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found or unauthorized" },
        { status: 404 }
      );
    }

    const existingPayment = await prisma.leadPayment.findFirst({
      where: {
        id: resolvedParams.paymentId,
        leadId: resolvedParams.id,
        ...(tenantFilter.companyId
          ? { companyId: tenantFilter.companyId }
          : {}),
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    const existingMetadata = parsePaymentNotes(existingPayment.notes);

    const voidedNotes = buildPaymentNotes(
      existingMetadata.paymentMethod,
      existingMetadata.referenceId,
      "VOIDED",
      existingMetadata.notes
    );

    const voidedPayment = await prisma.leadPayment.update({
      where: {
        id: resolvedParams.paymentId,
      },
      data: {
        notes: voidedNotes,
      },
    });

    return NextResponse.json({
      ...voidedPayment,
      paymentMethod: existingMetadata.paymentMethod || null,
      referenceId: existingMetadata.referenceId || null,
      status: "VOIDED",
      notes: existingMetadata.notes || null,
    });
  } catch (error) {
    console.error("DELETE (Void) payment error:", error);

    return NextResponse.json(
      { error: "Failed to void payment" },
      { status: 500 }
    );
  }
}