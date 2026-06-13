// app/api/imports/[sessionId]/issues/[issueId]/route.ts
// Decision 35, Step 5: PATCH /api/imports/:sessionId/issues/:issueId — resolve anomaly
// Decision 19: rawData always preserved. resolvedData stores the correction.
// Decision 22: ImportedExpenseRaw record NEVER deleted.

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { z } from "zod";

const resolveSchema = z.object({
  status: z.enum(["APPROVED", "SKIPPED"]),
  resolvedAs: z.enum(["EXPENSE", "REFUND", "SETTLEMENT", "SKIPPED"]).optional(),
  resolvedData: z.record(z.unknown()).optional(), // corrected field values
  resolutionNote: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string; issueId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { sessionId, issueId } = await params;

    const importSession = await prisma.importSession.findUnique({
      where: { id: sessionId, importedByUserId: session.userId as string },
    });
    if (!importSession)
      return errorResponse(ERR.IMPORT_SESSION_NOT_FOUND, "Import session not found.", 404);

    const row = await prisma.importedExpenseRaw.findUnique({
      where: { id: issueId, importSessionId: sessionId },
    });
    if (!row)
      return errorResponse(ERR.NOT_FOUND, "Issue row not found.", 404);

    // Decision 21: Once committed, cannot re-resolve
    if (row.committedEntityId) {
      return errorResponse(
        ERR.IMPORT_ROW_ALREADY_COMMITTED,
        "This row has already been committed. It cannot be re-resolved.",
        409
      );
    }

    const body = await req.json();
    const parsed = resolveSchema.parse(body);

    // Decision 19: rawData untouched; resolvedData stores correction
    const updated = await prisma.importedExpenseRaw.update({
      where: { id: issueId },
      data: {
        status: parsed.status,
        resolvedAs: parsed.resolvedAs ?? (parsed.status === "SKIPPED" ? "SKIPPED" : undefined),
        resolvedData: parsed.resolvedData ?? undefined,
        resolutionNote: parsed.resolutionNote,
        approvedById: session.userId as string,
        approvedAt: new Date(),
      },
    });

    // Update session pending count
    const pendingCount = await prisma.importedExpenseRaw.count({
      where: { importSessionId: sessionId, status: "PENDING" },
    });
    await prisma.importSession.update({
      where: { id: sessionId },
      data: { rowsPendingReview: pendingCount },
    });

    return successResponse({
      issueId: updated.id,
      rowNumber: updated.rowNumber,
      status: updated.status,
      resolvedAs: updated.resolvedAs,
      approvedAt: updated.approvedAt,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return errorResponse(ERR.VALIDATION, "Validation failed.", 400, (err as z.ZodError).errors);
    console.error("PATCH /issues/:issueId error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
