// app/api/groups/[groupId]/expenses/[expenseId]/route.ts
// Decision 5: soft delete via deletedAt
// Decision 16: IMPORTED expenses are always immutable. MANUAL expenses
//              editable until settlement activity exists in the group.

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId, expenseId } = await params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, groupId, deletedAt: null },
    });
    if (!expense)
      return errorResponse(ERR.NOT_FOUND, "Expense not found or already deleted.", 404);

    // Decision 16: Imported expenses are immutable
    if (expense.source === "IMPORTED") {
      return errorResponse(
        "IMMUTABLE_EXPENSE",
        "Imported expenses cannot be deleted. Historical data is immutable.",
        409
      );
    }

    // Decision 16: Check if any settlement exists in this group after expense creation
    const settlementActivity = await prisma.settlement.findFirst({
      where: { groupId, deletedAt: null, settledAt: { gte: expense.createdAt } },
    });
    if (settlementActivity) {
      return errorResponse(
        "IMMUTABLE_EXPENSE",
        "This expense cannot be deleted because settlement activity exists in the group after it was created.",
        409
      );
    }

    // Soft delete — Decision 5
    const deleted = await prisma.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date() },
    });

    return successResponse({
      message: "Expense soft-deleted. Historical records preserved.",
      expenseId: deleted.id,
      deletedAt: deleted.deletedAt,
    });
  } catch (err) {
    console.error("DELETE /expenses/:expenseId error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId, expenseId } = await params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, groupId, deletedAt: null },
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            guestParticipant: { select: { id: true, name: true } },
          },
        },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!expense)
      return errorResponse(ERR.NOT_FOUND, "Expense not found.", 404);

    return successResponse(JSON.parse(JSON.stringify(expense)));
  } catch (err) {
    console.error("GET /expenses/:expenseId error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
