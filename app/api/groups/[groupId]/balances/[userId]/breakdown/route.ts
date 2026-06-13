// app/api/groups/[groupId]/balances/[userId]/breakdown/route.ts
// Decision 31: Dedicated breakdown endpoint (Rohan's traceability)
// Decision 30: Response includes expense breakdown + settlements applied

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId, userId } = await params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);

    // Get target user's membership window
    const targetMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!targetMembership)
      return errorResponse(ERR.NOT_FOUND, "User is not a member of this group.", 404);

    // Fetch all non-deleted expenses in the group, with participants
    const expenses = await prisma.expense.findMany({
      where: { groupId, deletedAt: null, transactionType: "EXPENSE" },
      include: {
        paidBy: { select: { id: true, name: true } },
        participants: {
          where: { userId },
          // Only get the rows for the target user
        },
      },
      orderBy: { date: "asc" },
    });

    // Build expense breakdown: only expenses where this user participated OR paid
    const expenseBreakdown: object[] = [];
    let rawBalance = 0;

    for (const exp of expenses) {
      const expDate = exp.date;
      // Decision 27: membership window check
      const joinedOk = targetMembership.joinedAt <= expDate;
      const leftOk = targetMembership.leftAt === null || targetMembership.leftAt >= expDate;
      if (!joinedOk || !leftOk) continue; // Sam's rule: skip if outside window

      const userParticipant = exp.participants.find((p) => p.userId === userId);
      const isPayer = exp.paidById === userId;

      if (!userParticipant && !isPayer) continue;

      const shareAmount = userParticipant ? Number(userParticipant.shareAmount) : 0;
      const amountPaid = isPayer ? Number(exp.convertedAmountINR ?? exp.amount) : 0;
      const netImpact = amountPaid - shareAmount; // positive = owed back, negative = owes

      rawBalance += netImpact;

      expenseBreakdown.push({
        expenseId: exp.id,
        expenseTitle: exp.description,
        expenseDate: exp.date.toISOString().slice(0, 10),
        paidBy: exp.paidBy.name,
        paidById: exp.paidById,
        originalAmount: Number(exp.originalAmount ?? exp.amount),
        originalCurrency: exp.originalCurrency ?? exp.currency,
        exchangeRate: exp.exchangeRate ? Number(exp.exchangeRate) : 1,
        convertedAmount: Number(exp.convertedAmountINR ?? exp.amount),
        participantShare: shareAmount,
        amountPaid,
        netImpact,
        source: exp.source,
        transactionType: exp.transactionType,
      });
    }

    // Settlements involving this user
    const settlements = await prisma.settlement.findMany({
      where: {
        groupId,
        deletedAt: null,
        OR: [{ payerId: userId }, { receiverId: userId }],
      },
      include: {
        payer: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { settledAt: "asc" },
    });

    let settlementsImpact = 0;
    const settlementsApplied = settlements.map((s) => {
      const direction = s.payerId === userId ? "PAID" : "RECEIVED";
      const impact = direction === "PAID" ? -Number(s.amount) : Number(s.amount);
      settlementsImpact += impact;
      return {
        settlementId: s.id,
        settledAt: s.settledAt.toISOString().slice(0, 10),
        amount: Number(s.amount),
        currency: s.currency,
        direction,
        with: direction === "PAID" ? s.receiver.name : s.payer.name,
        note: s.note,
      };
    });

    // Decision 30: rawBalance - settlements = currentBalance
    const totalOwed = rawBalance + settlementsImpact;

    return successResponse({
      userId,
      groupId,
      rawBalance: Math.round(rawBalance * 100) / 100,
      settlementsImpact: Math.round(settlementsImpact * 100) / 100,
      totalOwed: Math.round(totalOwed * 100) / 100,
      expenseBreakdown,
      settlementsApplied,
    });
  } catch (err) {
    console.error("GET /balances/:userId/breakdown error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
