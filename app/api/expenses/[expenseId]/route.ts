import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ expenseId: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { expenseId } = await params;
    
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        paidBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        }
      }
    });

    if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: expense.groupId, userId: session.userId as string } }
    });
    
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ 
      expense: JSON.parse(JSON.stringify(expense)),
      comments: JSON.parse(JSON.stringify(expense.comments))
    });
  } catch (error: any) {
    console.error("GET Expense Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
