// app/api/imports/route.ts
// Decision 35, Step 1: POST /api/imports — creates an ImportSession

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { z } from "zod";

const createSessionSchema = z.object({
  groupId: z.string().uuid(),
  filename: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const body = await req.json();
    const parsed = createSessionSchema.parse(body);

    // Verify membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId: parsed.groupId, userId: session.userId as string },
      },
    });
    if (!membership)
      return errorResponse(ERR.FORBIDDEN, "You are not a member of this group.", 403);

    const importSession = await prisma.importSession.create({
      data: {
        groupId: parsed.groupId,
        importedByUserId: session.userId as string,
        filename: parsed.filename,
        status: "PARSING",
      },
    });

    return successResponse({ sessionId: importSession.id, status: importSession.status }, 201);
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return errorResponse(ERR.VALIDATION, "Validation failed.", 400, (err as z.ZodError).errors);
    console.error("POST /imports error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const url = new URL(req.url);
    const groupId = url.searchParams.get("groupId");

    const sessions = await prisma.importSession.findMany({
      where: {
        importedByUserId: session.userId as string,
        ...(groupId ? { groupId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(sessions);
  } catch (err) {
    console.error("GET /imports error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
