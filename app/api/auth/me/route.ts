// app/api/auth/me/route.ts
// GET current user, PATCH to update profile

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { z } from "zod";
import bcrypt from "bcrypt";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).max(128).optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId as string },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const body = await req.json();
    const parsed = updateProfileSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.userId as string },
    });
    if (!user)
      return errorResponse(ERR.NOT_FOUND, "User not found.", 404);

    // Handle password change
    if (parsed.newPassword) {
      if (!parsed.currentPassword) {
        return errorResponse(ERR.VALIDATION, "Current password is required to set a new password.", 400);
      }
      const passwordMatch = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
      if (!passwordMatch) {
        return errorResponse(ERR.VALIDATION, "Current password is incorrect.", 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId as string },
      data: {
        ...(parsed.name && { name: parsed.name }),
        ...(parsed.newPassword && { passwordHash: await bcrypt.hash(parsed.newPassword, 10) }),
      },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    });

    return successResponse(updatedUser);
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return errorResponse(ERR.VALIDATION, "Validation failed.", 400, err.errors);
    console.error("PATCH /auth/me error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
