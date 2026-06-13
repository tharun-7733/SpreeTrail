import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ groupId: string; expenseId: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { groupId, expenseId } = await params;
    
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    
    // Only creator of the expense or group admin can delete it
    // For MVP, if they created it, they can delete it
    if (expense.createdById !== session.userId) {
      // Check if admin
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: session.userId as string } }
      });
      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden: You cannot delete this expense" }, { status: 403 });
      }
    }

    await prisma.expense.delete({
      where: { id: expenseId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
