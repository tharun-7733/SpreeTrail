// app/api/imports/[sessionId]/issues/route.ts
// Decision 35, Step 4: GET /api/imports/:sessionId/issues — list anomalies

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { sessionId } = await params;
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") as "PENDING" | "APPROVED" | "SKIPPED" | null;

    const importSession = await prisma.importSession.findUnique({
      where: { id: sessionId, importedByUserId: session.userId as string },
    });
    if (!importSession)
      return errorResponse(ERR.IMPORT_SESSION_NOT_FOUND, "Import session not found.", 404);

    const rows = await prisma.importedExpenseRaw.findMany({
      where: {
        importSessionId: sessionId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { rowNumber: "asc" },
    });

    // Filter to rows that have anomalies needing review
    const issueRows = rows.filter((r) => {
      const anomalies = r.anomalies as Array<{ requiresApproval?: boolean }> | null;
      return anomalies && anomalies.some((a) => a.requiresApproval);
    });

    return successResponse({
      sessionId,
      totalIssues: issueRows.length,
      pending: issueRows.filter((r) => r.status === "PENDING").length,
      approved: issueRows.filter((r) => r.status === "APPROVED").length,
      skipped: issueRows.filter((r) => r.status === "SKIPPED").length,
      issues: issueRows.map((r) => ({
        id: r.id,
        rowNumber: r.rowNumber,
        status: r.status,
        rawData: r.rawData,
        resolvedData: r.resolvedData,
        anomalies: r.anomalies,
        resolvedAs: r.resolvedAs,
        committedEntityId: r.committedEntityId,
        approvedAt: r.approvedAt,
        resolutionNote: r.resolutionNote,
      })),
    });
  } catch (err) {
    console.error("GET /imports/:sessionId/issues error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
