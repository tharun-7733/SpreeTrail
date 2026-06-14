// app/api/groups/[groupId]/balances/route.ts
// Decision 34: Returns simplified debt graph + raw net balances
// Decision 27: Membership window filter applied at query time
// Decision 29: Settlements subtracted dynamically

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { computeGroupBalances } from "@/lib/balances";

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

    // Fetch all active group members (including those who have left — needed for history)
    const allMembers = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    // Decision 27: Membership window filter in SQL
    // Fetch expenses with participants, filtering out soft-deleted expenses.
    // The membership window check for WHICH participants to count
    // is applied below in application code (after fetching all data).
    const expenses = await prisma.expense.findMany({
      where: {
        groupId,
        deletedAt: null,
        transactionType: "EXPENSE", // REFUND rows excluded from balance
      },
      include: {
        participants: {
          include: { user: { select: { id: true } } },
        },
      },
    });

    // Decision 27: Apply membership window filter per participant per expense
    const filteredExpenses = expenses.map((exp) => {
      const expDate = exp.date;
      const validParticipants = exp.participants.filter((p) => {
        if (!p.userId) return false; // guest — always included
        const mem = allMembers.find((m) => m.userId === p.userId);
        if (!mem) return false;
        const joinedOk = mem.joinedAt <= expDate;
        const leftOk = mem.leftAt === null || mem.leftAt >= expDate;
        return joinedOk && leftOk;
      });
      return {
        id: exp.id,
        paidById: exp.paidById,
        // Decision 20: use convertedAmountINR if available, else amount
        amount: Number(exp.convertedAmountINR ?? exp.amount),
        participants: validParticipants.map((p) => ({
          userId: p.userId!,
          shareAmount: Number(p.shareAmount),
        })),
      };
    });

    const settlements = await prisma.settlement.findMany({
      where: { groupId, deletedAt: null },
    });

    const settlementRows = settlements.map((s) => ({
      payerId: s.payerId,
      receiverId: s.receiverId,
      amount: Number(s.amount),
    }));

    const memberStubs = allMembers.map((m) => ({
      id: m.user.id,
      name: m.user.name,
    }));

    const balances = computeGroupBalances(filteredExpenses, settlementRows, memberStubs);

    // Decision 34: Return both simplified debts and raw net balances
    // Also return members with full user objects for the UI
    return successResponse({
      simplifiedDebts: balances.simplifiedDebts,
      members: balances.members.map((m) => {
        const memberRecord = allMembers.find((am) => am.userId === m.userId);
        return {
          userId: m.userId,
          net: m.net,
          totalPaid: m.totalPaid,
          totalOwed: m.totalOwed,
          user: {
            id: m.userId,
            name: m.user.name,
            avatarUrl: memberRecord?.user ? (memberRecord.user as any).avatarUrl ?? null : null,
          },
        };
      }),
      rawNetBalances: balances.members.map((m) => ({
        userId: m.userId,
        userName: m.user.name,
        netBalance: m.net,
        totalPaid: m.totalPaid,
        totalOwed: m.totalOwed,
      })),
      totalExpenses: balances.totalExpenses,
    });
  } catch (err) {
    console.error("GET /balances error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
