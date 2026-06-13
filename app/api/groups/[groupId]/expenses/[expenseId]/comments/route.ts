import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string; expenseId: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { groupId, expenseId } = await params;
    
    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } }
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const comment = await prisma.expenseComment.create({
      data: {
        expenseId,
        userId: session.userId as string,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to add comment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
