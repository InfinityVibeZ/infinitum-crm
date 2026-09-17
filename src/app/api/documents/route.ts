import { requireFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantWhereClauseAsync,
  requireAuthenticatedUser,
} from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) return auth;

    const { payload } = auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const tenantFilter = await getTenantWhereClauseAsync(payload);

    let docFilter: any = {
      ...tenantFilter,
    };

    if (payload.role === "ADMIN") {
      docFilter = {
        AND: [
          tenantFilter,
          {
            deal: {
              OR: [
                { userId: payload.userId },
                {
                  user: {
                    createdBy: payload.userId,
                  },
                },
              ],
            },
          },
        ],
      };
    } else if (payload.role === "USER") {
      docFilter = {
        AND: [
          tenantFilter,
          {
            deal: {
              userId: payload.userId,
            },
          },
        ],
      };
    }

    const where: any = {
      ...docFilter,
    };

    if (type && type !== "ALL") {
      where.type = type;
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        deal: {
          select: {
            id: true,
            name: true,
            value: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("GET /api/documents error:", error);

    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) return auth;

    const { payload } = auth;

    const featureError = await requireFeature(
      payload.companyId,
      "DOCUMENTS"
    );

    if (featureError) return featureError;

    const body = await request.json();

    const {
      name,
      type,
      filePath,
      fileSize,
      fileType,
      dealId,
    } = body;

    if (!name || !filePath || !dealId) {
      return NextResponse.json(
        {
          error:
            "Document name, file path, and associated deal are required",
        },
        { status: 400 }
      );
    }

    // Verify that the deal belongs to the caller's tenant
    // before attaching a document to it.
    const tenantFilter =
      await getTenantWhereClauseAsync(payload);

    const deal = await prisma.deal.findFirst({
      where: {
        id: dealId,
        ...tenantFilter,
      },
      select: {
        id: true,
      },
    });

    if (!deal) {
      return NextResponse.json(
        {
          error: "Deal not found or unauthorized",
        },
        { status: 404 }
      );
    }

    const newDoc = await prisma.document.create({
      data: {
        name,
        type: type || "PROPOSAL",

        // Prisma Document uses `url`, not `filePath`.
        url: filePath,

        // Prisma Document uses `size`, not `fileSize`.
        size: fileSize
          ? parseInt(fileSize, 10)
          : 1024,

        // Prisma Document uses `mime_type`, not `fileType`.
        mime_type:
          fileType || "application/pdf",

        dealId,

        uploadedBy: payload.userId,

        companyId: payload.companyId as string,
      },
      include: {
        deal: true,
        uploader: true,
      },
    });

    return NextResponse.json(
      newDoc,
      { status: 201 }
    );
  } catch (error: any) {
    console.error(
      "POST /api/documents error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to create document",
      },
      { status: 500 }
    );
  }
}