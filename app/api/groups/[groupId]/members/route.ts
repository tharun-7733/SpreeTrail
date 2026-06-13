// app/api/groups/[groupId]/members/route.ts
// Decision 32: POST /api/groups/:groupId/members — add member (admin only)
// Decision 12: UI enforces membership validity. Importer preserves history.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { z } from "zod";

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
  joinedAt: z.string().optional(), // ISO date string, defaults to now
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { groupId } = await params;

    // Caller must be ADMIN
    const callerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.userId as string } },
    });
    if (!callerMembership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);
    if (callerMembership.role !== "ADMIN")
      return errorResponse(ERR.FORBIDDEN, "Only group admins can add members.", 403);

    const body = await req.json();
    const parsed = addMemberSchema.parse(body);

    // Check if user already exists in group
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: parsed.userId } },
    });
    if (existing)
      return errorResponse("ALREADY_MEMBER", "User is already a member of this group.", 409);

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId: parsed.userId,
        role: parsed.role,
        joinedAt: parsed.joinedAt ? new Date(parsed.joinedAt) : new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return successResponse(member, 201);
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return errorResponse(ERR.VALIDATION, "Validation failed.", 400, err.errors);
    console.error("POST /members error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}

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

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    return successResponse(members);
  } catch (err) {
    console.error("GET /members error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
