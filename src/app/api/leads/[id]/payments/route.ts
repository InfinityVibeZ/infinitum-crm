import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantWhereClauseAsync,
  requireAuthenticatedUser,
} from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth =
      await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter =
      await getTenantWhereClauseAsync(payload);

    const lead =
      await prisma.lead.findFirst({
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
        {
          error:
            "Lead not found or unauthorized",
        },
        { status: 404 }
      );
    }

    const payments =
      await prisma.leadPayment.findMany({
        where: {
          leadId: resolvedParams.id,
          companyId:
            payload.companyId as string,
        },

        orderBy: {
          paymentDate: "desc",
        },
      });

    return NextResponse.json(payments);
  } catch (error) {
    console.error(
      "GET /api/leads/[id]/payments error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch payments",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth =
      await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const body = await request.json();

    const {
      amount,
      paymentDate,
      paymentMethod,
      referenceId,
      notes,
      status,
    } = body;

    /*
     * -------------------------------------------------------
     * VALIDATE AMOUNT
     * -------------------------------------------------------
     */

    const numAmount =
      typeof amount === "number"
        ? amount
        : parseFloat(
            String(amount ?? "")
          );

    if (
      !Number.isFinite(numAmount) ||
      numAmount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Amount must be a positive number greater than 0",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * VALIDATE PAYMENT DATE
     * -------------------------------------------------------
     */

    if (!paymentDate) {
      return NextResponse.json(
        {
          error:
            "Payment Date is required",
        },
        { status: 400 }
      );
    }

    const parsedPaymentDate =
      new Date(paymentDate);

    if (
      Number.isNaN(
        parsedPaymentDate.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid payment date",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * TENANT VALIDATION
     * -------------------------------------------------------
     */

    const tenantFilter =
      await getTenantWhereClauseAsync(
        payload
      );

    const lead =
      await prisma.lead.findFirst({
        where: {
          id: resolvedParams.id,
          ...tenantFilter,
        },
      });

    if (!lead) {
      return NextResponse.json(
        {
          error:
            "Lead not found or unauthorized",
        },
        { status: 404 }
      );
    }

    /*
     * -------------------------------------------------------
     * PAYMENT NOTES
     *
     * LeadPayment does not have:
     * paymentMethod
     * referenceId
     * status
     *
     * Preserve these values in the notes JSON
     * rather than changing the database schema.
     * -------------------------------------------------------
     */

    const paymentMetadata = {
      paymentMethod:
        paymentMethod || null,

      referenceId:
        referenceId || null,

      status:
        status || "PAID",

      notes:
        notes || null,
    };

    const paymentNotes =
      JSON.stringify(
        paymentMetadata
      );

    /*
     * -------------------------------------------------------
     * CREATE PAYMENT
     * -------------------------------------------------------
     */

    const payment =
      await prisma.leadPayment.create({
        data: {
          companyId:
            payload.companyId as string,

          leadId:
            resolvedParams.id,

          amount:
            numAmount,

          paymentDate:
            parsedPaymentDate,

          notes:
            paymentNotes,
        },
      });

    /*
     * -------------------------------------------------------
     * UPDATE LEAD CASH COLLECTED
     * -------------------------------------------------------
     *
     * All LeadPayment records for this lead
     * are treated as collected payments because
     * the schema has no payment status column.
     * -------------------------------------------------------
     */

    
    /*
     * -------------------------------------------------------
     * RETURN PAYMENT
     * -------------------------------------------------------
     *
     * Return the legacy fields as part of the API
     * response so the existing frontend can continue
     * consuming them.
     * -------------------------------------------------------
     */

    return NextResponse.json({
      ...payment,

      paymentMethod:
        paymentMethod || null,

      referenceId:
        referenceId || null,

      status:
        status || "PAID",
    });
  } catch (error) {
    console.error(
      "POST /api/leads/[id]/payments error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create payment",
      },
      { status: 500 }
    );
  }
}