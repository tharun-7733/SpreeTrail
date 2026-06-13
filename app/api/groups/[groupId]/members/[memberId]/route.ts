// app/api/groups/[groupId]/members/[memberId]/route.ts
// Decision 32: DELETE /api/groups/:groupId/members/:memberId (admin only)
// Decision 5: Soft delete via leftAt timestamp, not hard delete

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId, memberId } = await params;

    // Caller must be ADMIN
    const callerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!callerMembership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);
    if (callerMembership.role !== "ADMIN")
      return errorResponse(ERR.FORBIDDEN, "Only group admins can remove members.", 403);

    // Fetch the membership record to remove
    const target = await prisma.groupMember.findUnique({
      where: { id: memberId, groupId },
    });
    if (!target)
      return errorResponse(ERR.NOT_FOUND, "Member not found in this group.", 404);

    // Cannot remove the last ADMIN
    if (target.role === "ADMIN") {
      const adminCount = await prisma.groupMember.count({
        where: { groupId, role: "ADMIN", leftAt: null },
      });
      if (adminCount <= 1)
        return errorResponse(
          "LAST_ADMIN",
          "Cannot remove the last admin from the group.",
          409
        );
    }

    // Decision 5 + Decision 11: set leftAt = now() instead of deleting
    const updated = await prisma.groupMember.update({
      where: { id: memberId },
      data: { leftAt: new Date() },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse({
      message: `${updated.user.name} removed from group. Historical balances are preserved.`,
      leftAt: updated.leftAt,
    });
  } catch (err) {
    console.error("DELETE /members/:memberId error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
