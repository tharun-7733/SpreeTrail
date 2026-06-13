// app/api/imports/[sessionId]/upload/route.ts
// Decision 35, Step 2: POST /api/imports/:sessionId/upload
// Parses CSV, runs pure anomaly detection, stores ImportedExpenseRaw rows.
// Also runs cross-session duplicate check (DB-level anomaly).

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { errorResponse, successResponse, ERR } from "@/lib/errorResponse";
import { parseImportCsv } from "@/lib/importParser";
import { isMemberActiveAt } from "@/lib/membershipUtils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId)
      return errorResponse(ERR.UNAUTHORIZED, "Authentication required.", 401);

    const { sessionId } = await params;

    const importSession = await prisma.importSession.findUnique({
      where: { id: sessionId, importedByUserId: session.userId as string },
      include: { group: { include: { members: { include: { user: { select: { id: true, name: true } } } } } } },
    });
    if (!importSession)
      return errorResponse(ERR.IMPORT_SESSION_NOT_FOUND, "Import session not found.", 404);

    if (importSession.status !== "PARSING")
      return errorResponse("SESSION_LOCKED", "CSV has already been uploaded for this session.", 409);

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return errorResponse(ERR.VALIDATION, "No file provided. Send a multipart form with field 'file'.", 400);

    const csvContent = await file.text();
    if (!csvContent.trim())
      return errorResponse(ERR.VALIDATION, "Uploaded file is empty.", 400);

    // Decision 38: Pure anomaly detection (intra-CSV)
    const parsedRows = parseImportCsv(csvContent);

    // Fetch existing expenses for cross-session duplicate check (DB-level)
    const existingExpenses = await prisma.expense.findMany({
      where: { groupId: importSession.groupId, deletedAt: null },
      select: { date: true, amount: true, description: true, paidById: true },
    });

    // Fetch all group members for UNKNOWN_MEMBER + INACTIVE_MEMBER_AT_DATE checks
    const groupMembers = importSession.group.members;
    const knownNames = groupMembers.map((m) => m.user.name.toLowerCase());

    // Store each row as ImportedExpenseRaw with anomalies
    const rowsToCreate = parsedRows.map((row) => {
      const additionalAnomalies = [...(row.anomalies ?? [])];

      // Cross-session duplicate detection (requires DB data)
      if (row.parsedDate && row.parsedAmount && row.rawData.description) {
        const dupExists = existingExpenses.some((e) => {
          const sameDate = e.date.toISOString().slice(0, 10) === row.parsedDate!.toISOString().slice(0, 10);
          const sameAmount = Math.abs(Number(e.amount) - row.parsedAmount!) < 0.01;
          const sameDesc = e.description.toLowerCase() === String(row.rawData.description ?? "").toLowerCase();
          return sameDate && sameAmount && sameDesc;
        });
        if (dupExists) {
          additionalAnomalies.push({
            anomalyType: "DUPLICATE_EXPENSE",
            severity: "ERROR",
            field: "row",
            rawValue: `${row.parsedDate?.toISOString().slice(0, 10)}|${row.parsedAmount}`,
            message: "This expense already exists in the database for this group (cross-session duplicate).",
            requiresApproval: true,
          });
        }
      }

      // UNKNOWN_MEMBER check: payer name not in group
      const rawPaidBy = String(row.rawData.paid_by || row.rawData.paidby || "").trim().toLowerCase();
      if (rawPaidBy && !knownNames.some((n) => n.includes(rawPaidBy) || rawPaidBy.includes(n))) {
        additionalAnomalies.push({
          anomalyType: "UNKNOWN_MEMBER",
          severity: "ERROR",
          field: "paid_by",
          rawValue: rawPaidBy,
          message: `Payer "${rawPaidBy}" is not a known group member. Please map to an existing user or create a guest.`,
          requiresApproval: true,
        });
      }

      // INACTIVE_MEMBER_AT_DATE check (Decision 23)
      if (row.parsedDate && rawPaidBy) {
        const matchedMember = groupMembers.find((m) =>
          m.user.name.toLowerCase().includes(rawPaidBy) ||
          rawPaidBy.includes(m.user.name.toLowerCase())
        );
        if (matchedMember && !isMemberActiveAt(matchedMember, row.parsedDate!)) {
          additionalAnomalies.push({
            anomalyType: "INACTIVE_MEMBER_AT_DATE",
            severity: "WARNING",
            field: "paid_by",
            rawValue: rawPaidBy,
            message: `${matchedMember.user.name} was not an active member on ${row.parsedDate!.toISOString().slice(0, 10)} (joined: ${matchedMember.joinedAt.toISOString().slice(0, 10)}${matchedMember.leftAt ? `, left: ${matchedMember.leftAt.toISOString().slice(0, 10)}` : ""}).`,
            requiresApproval: true,
          });
        }
      }

      return {
        importSessionId: sessionId,
        rowNumber: row.rowNumber,
        rawData: row.rawData as object,
        anomalies: additionalAnomalies as object,
        status: ("PENDING" as const),
      };
    });

    // Decision 21: Batch insert all rows
    await prisma.$transaction(async (tx: typeof prisma) => {
      await (tx as typeof prisma).importedExpenseRaw.createMany({ data: rowsToCreate });

      const pendingCount = rowsToCreate.filter((r) =>
        (r.anomalies as { requiresApproval?: boolean }[]).some((a) => a.requiresApproval)
      ).length;

      await (tx as typeof prisma).importSession.update({
        where: { id: sessionId },
        data: {
          totalRows: parsedRows.length,
          rowsPendingReview: pendingCount,
          status: "ANOMALY_REVIEW",
        },
      });
    });

    const anomalyCount = rowsToCreate.filter(
      (r) => (r.anomalies as Array<{ requiresApproval?: boolean }>).some((a) => a.requiresApproval)
    ).length;

    return successResponse({
      totalRows: parsedRows.length,
      cleanRows: parsedRows.length - anomalyCount,
      rowsWithAnomalies: anomalyCount,
      nextStep: `/api/imports/${sessionId}/issues`,
    }, 201);
  } catch (err) {
    console.error("POST /imports/:sessionId/upload error:", err);
    return errorResponse(ERR.INTERNAL, "Internal server error.", 500);
  }
}
