// app/api/imports/[sessionId]/route.ts
// Decision 35, Step 3: GET /api/imports/:sessionId — session status + progress

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { sessionId } = await params;

    const importSession = await prisma.importSession.findUnique({
      where: { id: sessionId, importedByUserId: session.userId as string },
      include: {
        group: { select: { id: true, name: true } },
        importedBy: { select: { id: true, name: true } },
      },
    });

    if (!importSession)
      return errorResponse(ERR.IMPORT_SESSION_NOT_FOUND, "Import session not found.", 404);

    // Count anomalies from rows
    const totalAnomalies = await prisma.importedExpenseRaw.count({
      where: {
        importSessionId: sessionId,
        status: "PENDING",
      },
    });

    return successResponse({
      ...importSession,
      totalAnomalies,
    });
  } catch (err) {
    console.error("GET /imports/:sessionId error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
