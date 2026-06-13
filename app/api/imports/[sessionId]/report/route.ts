// app/api/imports/[sessionId]/report/route.ts
// Decision 35, Step 7: GET /api/imports/:sessionId/report
// Decision 25: Report is COMPUTED ON DEMAND — not stored separately.
//              Every field maps to existing ImportSession + ImportedExpenseRaw columns.

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
        importedBy: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });
    if (!importSession)
      return errorResponse(ERR.IMPORT_SESSION_NOT_FOUND, "Import session not found.", 404);

    // Decision 25: All report fields derived from existing tables
    const rows = await prisma.importedExpenseRaw.findMany({
      where: { importSessionId: sessionId },
      include: {
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { rowNumber: "asc" },
    });

    // Aggregate counts
    const rowsImported = rows.filter((r: any) => r.resolvedAs === "EXPENSE" || r.resolvedAs === "REFUND").length;
    const rowsConvertedToSettlements = rows.filter((r: any) => r.resolvedAs === "SETTLEMENT").length;
    const rowsSkipped = rows.filter((r: any) => r.resolvedAs === "SKIPPED" || r.status === "SKIPPED").length;
    const rowsPending = rows.filter((r: any) => r.status === "PENDING").length;
    const totalAnomalies = rows.reduce((sum: number, r: any) => {
      const anomalies = r.anomalies as Array<unknown> | null;
      return sum + (anomalies?.length ?? 0);
    }, 0);

    const perRowDetails = rows.map((r: any) => ({
      rowNumber: r.rowNumber,
      originalCSVData: r.rawData,
      resolvedData: r.resolvedData,
      anomalies: r.anomalies,
      status: r.status,
      resolvedAs: r.resolvedAs,
      committedEntityId: r.committedEntityId,
      approvedBy: r.approvedBy ? { id: r.approvedBy.id, name: r.approvedBy.name } : null,
      approvedAt: r.approvedAt,
      resolutionNote: r.resolutionNote,
    }));

    return successResponse({
      // Import metadata
      importSessionId: importSession.id,
      importedBy: importSession.importedBy,
      importedAt: importSession.createdAt,
      completedAt: importSession.completedAt,
      fileName: importSession.filename,
      group: importSession.group,
      // Summary
      totalRows: importSession.totalRows,
      rowsImported,
      rowsConvertedToSettlements,
      rowsSkipped,
      rowsPending,
      totalAnomalies,
      // Per-row details (Rohan's traceability requirement)
      rows: perRowDetails,
    });
  } catch (err) {
    console.error("GET /imports/:sessionId/report error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
