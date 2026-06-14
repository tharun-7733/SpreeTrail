import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { z } from "zod";

const updateGroupSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { groupId } = await params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    });

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const isMember = group.members.some(m => m.userId === session.userId);
    if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId } = await params;

    // Only ADMIN can update group
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);
    if (membership.role !== "ADMIN")
      return errorResponse(ERR.FORBIDDEN, "Only group admins can update group settings.", 403);

    const body = await req.json();
    const parsed = updateGroupSchema.parse(body);

    const group = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.description !== undefined && { description: parsed.description }),
      },
    });

    return successResponse(group);
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return errorResponse(ERR.VALIDATION, "Validation failed.", 400, err.errors);
    console.error("PATCH /groups/:groupId error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId } = await params;

    // Only ADMIN (and creator) can delete group
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);
    if (membership.role !== "ADMIN")
      return errorResponse(ERR.FORBIDDEN, "Only group admins can delete this group.", 403);

    // Cascade delete handled by Prisma onDelete: Cascade
    await prisma.group.delete({ where: { id: groupId } });

    return successResponse({ message: "Group deleted successfully." });
  } catch (err) {
    console.error("DELETE /groups/:groupId error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
