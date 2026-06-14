// app/api/groups/[groupId]/expenses/[expenseId]/comments/route.ts
// GET and POST comments for a specific expense

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { z } from "zod";

const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
});

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

    const comments = await prisma.expenseComment.findMany({
      where: { expenseId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return successResponse(JSON.parse(JSON.stringify(comments)));
  } catch (err) {
    console.error("GET /comments error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}

export async function POST(
  req: Request,
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

    // Verify expense belongs to this group
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId, groupId, deletedAt: null },
    });
    if (!expense)
      return errorResponse(ERR.NOT_FOUND, "Expense not found.", 404);

    const body = await req.json();
    const parsed = commentSchema.parse(body);

    const comment = await prisma.expenseComment.create({
      data: {
        expenseId,
        userId: session.userId as string,
        content: parsed.content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return successResponse(JSON.parse(JSON.stringify(comment)), 201);
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return errorResponse(ERR.VALIDATION, "Validation failed.", 400, err.errors);
    console.error("POST /comments error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
