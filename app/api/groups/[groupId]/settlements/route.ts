// app/api/groups/[groupId]/settlements/route.ts
// Decision 32: GET /api/groups/:groupId/settlements + POST
// Decision 29: Settlements applied dynamically at query time — never mutate expenses

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { z } from "zod";

const settlementSchema = z.object({
  payerId: z.string().uuid(),
  receiverId: z.string().uuid(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("INR"),
  note: z.string().optional(),
  settledAt: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId } = await params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);

    // Decision 44: always filter deletedAt IS NULL
    const settlements = await prisma.settlement.findMany({
      where: { groupId, deletedAt: null },
      include: {
        payer: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { settledAt: "desc" },
    });

    return successResponse(JSON.parse(JSON.stringify(settlements)));
  } catch (err) {
    console.error("GET /settlements error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId } = await params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);

    const body = await req.json();
    const parsed = settlementSchema.parse(body);

    if (parsed.payerId === parsed.receiverId)
      return errorResponse(ERR.VALIDATION, "Payer and receiver cannot be the same person.", 400);

    // Verify both parties are members (including those who have left — historical)
    const [payerMember, receiverMember] = await Promise.all([
      prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: parsed.payerId } },
      }),
      prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: parsed.receiverId } },
      }),
    ]);
    if (!payerMember)
      return errorResponse(ERR.NOT_FOUND, "Payer is not a member of this group.", 404);
    if (!receiverMember)
      return errorResponse(ERR.NOT_FOUND, "Receiver is not a member of this group.", 404);

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        payerId: parsed.payerId,
        receiverId: parsed.receiverId,
        amount: parsed.amount,
        currency: parsed.currency,
        note: parsed.note,
        settledAt: parsed.settledAt ? new Date(parsed.settledAt) : new Date(),
      },
      include: {
        payer: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return successResponse(JSON.parse(JSON.stringify(settlement)), 201);
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return errorResponse(ERR.VALIDATION, "Validation failed.", 400, err.errors);
    console.error("POST /settlements error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
