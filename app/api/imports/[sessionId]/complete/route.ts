// app/api/imports/[sessionId]/complete/route.ts
// Decision 35, Step 6: POST /api/imports/:sessionId/complete
// Decision 21: Each row commit is a single DB transaction. Idempotency via committedEntityId.
// Decision 22: Settlement rows go to Settlement table, not Expense.

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";

export async function POST(
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
    });
    if (!importSession)
      return errorResponse(ERR.IMPORT_SESSION_NOT_FOUND, "Import session not found.", 404);

    if (importSession.status === "COMPLETED")
      return successResponse({ message: "Import already completed.", sessionId });

    // Update session to COMMITTING
    await prisma.importSession.update({
      where: { id: sessionId },
      data: { status: "COMMITTING" },
    });

    // Fetch all approved, not-yet-committed rows
    const approvedRows = await prisma.importedExpenseRaw.findMany({
      where: {
        importSessionId: sessionId,
        status: "APPROVED",
        committedEntityId: null, // idempotency: skip already committed
      },
    });

    let committed = 0;
    let skipped = 0;
    const errors: { rowNumber: number; error: string }[] = [];

    for (const row of approvedRows) {
      try {
        const resolved = (row.resolvedData as Record<string, unknown>) ?? (row.rawData as Record<string, unknown>);
        const resolvedAs = row.resolvedAs;

        if (resolvedAs === "SKIPPED" || resolvedAs === null) {
          skipped++;
          continue;
        }

        if (resolvedAs === "SETTLEMENT") {
          // Decision 22: Settlement-disguised-as-expense goes to Settlement table
          await prisma.$transaction(async (tx: typeof prisma) => {
            const settlement = await (tx as typeof prisma).settlement.create({
              data: {
                groupId: importSession.groupId,
                payerId: String(resolved.payerId ?? resolved.paidById ?? ""),
                receiverId: String(resolved.receiverId ?? ""),
                amount: parseFloat(String(resolved.amount ?? 0)),
                currency: String(resolved.currency ?? "INR"),
                note: String(resolved.description ?? resolved.note ?? "Imported from CSV"),
                settledAt: resolved.date ? new Date(String(resolved.date)) : new Date(),
              },
            });
            await (tx as typeof prisma).importedExpenseRaw.update({
              where: { id: row.id },
              data: { committedEntityId: settlement.id },
            });
          });
          committed++;
        } else {
          // EXPENSE or REFUND
          const amount = Math.abs(parseFloat(String(resolved.amount ?? 0)));
          const exchangeRate = resolved.exchangeRate ? parseFloat(String(resolved.exchangeRate)) : null;
          const originalCurrency = String(resolved.originalCurrency ?? resolved.currency ?? "INR");
          const isINR = originalCurrency === "INR";

          await prisma.$transaction(async (tx: typeof prisma) => {
            const expense = await (tx as typeof prisma).expense.create({
              data: {
                groupId: importSession.groupId,
                paidById: String(resolved.paidById ?? ""),
                createdById: session.userId as string,
                description: String(resolved.description ?? "Imported expense"),
                amount: amount,
                currency: isINR ? "INR" : String(resolved.currency ?? "INR"),
                originalAmount: !isINR ? amount : null,
                originalCurrency: !isINR ? originalCurrency : null,
                exchangeRate: exchangeRate,
                convertedAmountINR: exchangeRate ? amount * exchangeRate : amount,
                splitType: (String(resolved.splitType ?? resolved.split_type ?? "EQUAL").toUpperCase() as "EQUAL" | "UNEQUAL" | "PERCENTAGE" | "SHARES"),
                transactionType: resolvedAs === "REFUND" ? "REFUND" : "EXPENSE",
                source: "IMPORTED",
                date: resolved.date ? new Date(String(resolved.date)) : new Date(),
              },
            });
            await (tx as typeof prisma).importedExpenseRaw.update({
              where: { id: row.id },
              data: { committedEntityId: expense.id },
            });
          });
          committed++;
        }
      } catch (rowErr: unknown) {
        errors.push({ rowNumber: row.rowNumber, error: String(rowErr) });
      }
    }

    // Update skipped rows
    await prisma.importedExpenseRaw.updateMany({
      where: { importSessionId: sessionId, status: "APPROVED", resolvedAs: "SKIPPED" },
      data: { status: "SKIPPED" },
    });

    const finalSkipped = await prisma.importedExpenseRaw.count({
      where: { importSessionId: sessionId, status: "SKIPPED" },
    });

    await prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: errors.length === 0 ? "COMPLETED" : "ANOMALY_REVIEW",
        rowsCommitted: committed,
        rowsSkipped: finalSkipped,
        rowsPendingReview: errors.length,
        completedAt: errors.length === 0 ? new Date() : null,
      },
    });

    return successResponse({
      sessionId,
      rowsCommitted: committed,
      rowsSkipped: finalSkipped,
      rowsFailed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      status: errors.length === 0 ? "COMPLETED" : "PARTIAL",
    });
  } catch (err) {
    console.error("POST /imports/:sessionId/complete error:", err);
    await prisma.importSession.update({
      where: { id: params as unknown as string },
      data: { status: "FAILED" },
    }).catch(() => {});
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
