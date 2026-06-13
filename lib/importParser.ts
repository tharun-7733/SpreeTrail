/**
 * lib/importParser.ts
 *
 * Decision 38: Anomaly detection is pure functions — no DB access.
 * Decision 23: Two distinct anomaly types: IDENTITY vs MEMBERSHIP.
 * Decision 19: rawData always preserved verbatim.
 * Decision 18: Negative amounts → REFUND type.
 *
 * ONLY intra-CSV anomalies are detected here.
 * Cross-session (DB) anomalies are detected in the upload API route.
 */

export interface RawCsvRow {
  rowNumber: number;
  // raw field values exactly as found in the CSV
  date?: string;
  description?: string;
  amount?: string;
  currency?: string;
  paidBy?: string;
  splitType?: string;
  participants?: string; // comma-separated names or JSON
  [key: string]: string | number | undefined;
}

export interface ParsedAnomaly {
  anomalyType: string;
  severity: "ERROR" | "WARNING" | "INFO";
  field: string;
  rawValue: string;
  message: string;
  requiresApproval: boolean;
}

export interface ParsedRow {
  rowNumber: number;
  rawData: RawCsvRow;
  anomalies: ParsedAnomaly[];
  isClean: boolean; // true if no errors (warnings OK)
  suggestedTransactionType: "EXPENSE" | "REFUND" | "SETTLEMENT";
  parsedDate?: Date;
  parsedAmount?: number;
}

// Settlement-indicating keywords (Decision 22)
const SETTLEMENT_KEYWORDS = [
  "paid back",
  "paid aisha back",
  "paid rohan back",
  "paid priya back",
  "paid meera back",
  "paid dev back",
  "paid sam back",
  "settled",
  "settlement",
  "repayment",
  "reimbursed",
  "transfer to",
  "sent money",
  "cash back",
  "deposit share",
];

/**
 * Main entry point — parse a CSV string into rows with anomalies.
 * Returns raw parsed rows. Does NOT touch the database.
 */
export function parseImportCsv(csvContent: string): ParsedRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: ParsedRow[] = [];
  const seenFingerprints = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const raw: RawCsvRow = { rowNumber: i + 1 };
    headers.forEach((h, idx) => {
      raw[h] = values[idx]?.trim() ?? "";
    });

    const anomalies: ParsedAnomaly[] = [];

    // ── Date validation ────────────────────────────────────────────────
    const rawDate = String(raw.date || raw.expense_date || "");
    let parsedDate: Date | undefined;
    if (!rawDate) {
      anomalies.push({
        anomalyType: "MISSING_DATE",
        severity: "ERROR",
        field: "date",
        rawValue: rawDate,
        message: "No date provided.",
        requiresApproval: true,
      });
    } else {
      const { date, ambiguous } = parseDate(rawDate);
      if (!date) {
        anomalies.push({
          anomalyType: "AMBIGUOUS_DATE",
          severity: "ERROR",
          field: "date",
          rawValue: rawDate,
          message: `Cannot parse date "${rawDate}". Acceptable formats: YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY.`,
          requiresApproval: true,
        });
      } else {
        parsedDate = date;
        if (ambiguous) {
          anomalies.push({
            anomalyType: "AMBIGUOUS_DATE",
            severity: "WARNING",
            field: "date",
            rawValue: rawDate,
            message: `Date "${rawDate}" is ambiguous. Interpreted as ${date.toISOString().slice(0, 10)}. Please confirm.`,
            requiresApproval: true,
          });
        }
      }
    }

    // ── Amount validation ──────────────────────────────────────────────
    const rawAmount = String(raw.amount || "");
    let parsedAmount: number | undefined;
    let txType: "EXPENSE" | "REFUND" | "SETTLEMENT" = "EXPENSE";

    if (!rawAmount) {
      anomalies.push({
        anomalyType: "ZERO_AMOUNT",
        severity: "ERROR",
        field: "amount",
        rawValue: rawAmount,
        message: "Amount is missing.",
        requiresApproval: true,
      });
    } else {
      const amt = parseFloat(rawAmount.replace(/[^0-9.\-]/g, ""));
      if (isNaN(amt)) {
        anomalies.push({
          anomalyType: "ZERO_AMOUNT",
          severity: "ERROR",
          field: "amount",
          rawValue: rawAmount,
          message: `Amount "${rawAmount}" is not a valid number.`,
          requiresApproval: true,
        });
      } else if (amt === 0) {
        anomalies.push({
          anomalyType: "ZERO_AMOUNT",
          severity: "ERROR",
          field: "amount",
          rawValue: rawAmount,
          message: "Amount is zero.",
          requiresApproval: true,
        });
      } else if (amt < 0) {
        // Decision 18: negative = REFUND, importer-only
        txType = "REFUND";
        parsedAmount = Math.abs(amt);
        anomalies.push({
          anomalyType: "NEGATIVE_AMOUNT",
          severity: "WARNING",
          field: "amount",
          rawValue: rawAmount,
          message: `Negative amount detected (${rawAmount}). This will be imported as a REFUND transaction.`,
          requiresApproval: false,
        });
      } else {
        parsedAmount = amt;
      }
    }

    // ── Description validation ────────────────────────────────────────
    const desc = String(raw.description || raw.title || "").trim();
    if (!desc) {
      anomalies.push({
        anomalyType: "MISSING_DESCRIPTION",
        severity: "WARNING",
        field: "description",
        rawValue: "",
        message: "No description provided. Row will be imported with a placeholder.",
        requiresApproval: false,
      });
    }

    // ── Settlement detection ──────────────────────────────────────────
    // Decision 22: heuristic on description + missing split_type
    const rawSplitType = String(raw.split_type || raw.splittype || "").trim();
    const descLower = desc.toLowerCase();
    const looksLikeSettlement =
      SETTLEMENT_KEYWORDS.some((kw) => descLower.includes(kw)) ||
      (!rawSplitType && descLower.includes("paid"));

    if (looksLikeSettlement && txType !== "REFUND") {
      txType = "SETTLEMENT";
      anomalies.push({
        anomalyType: "SETTLEMENT_AS_EXPENSE",
        severity: "WARNING",
        field: "description",
        rawValue: desc,
        message: `Row description "${desc}" looks like a settlement payment, not an expense. Please confirm whether to import as Settlement or Expense.`,
        requiresApproval: true,
      });
    }

    // ── Split type validation ─────────────────────────────────────────
    const validSplitTypes = ["EQUAL", "UNEQUAL", "PERCENTAGE", "SHARES", "SHARE"];
    if (!rawSplitType && txType === "EXPENSE") {
      anomalies.push({
        anomalyType: "INVALID_SPLIT_TYPE",
        severity: "ERROR",
        field: "split_type",
        rawValue: rawSplitType,
        message: "Split type is missing. Must be one of: EQUAL, UNEQUAL, PERCENTAGE, SHARES.",
        requiresApproval: true,
      });
    } else if (rawSplitType && !validSplitTypes.includes(rawSplitType.toUpperCase())) {
      anomalies.push({
        anomalyType: "INVALID_SPLIT_TYPE",
        severity: "ERROR",
        field: "split_type",
        rawValue: rawSplitType,
        message: `Unknown split type "${rawSplitType}". Must be one of: EQUAL, UNEQUAL, PERCENTAGE, SHARES.`,
        requiresApproval: true,
      });
    }

    // ── Payer validation ──────────────────────────────────────────────
    const rawPaidBy = String(raw.paid_by || raw.paidby || raw.payer || "").trim();
    if (!rawPaidBy) {
      anomalies.push({
        anomalyType: "MISSING_PAYER",
        severity: "ERROR",
        field: "paid_by",
        rawValue: rawPaidBy,
        message: "Payer is missing.",
        requiresApproval: true,
      });
    }

    // ── Currency validation ───────────────────────────────────────────
    const rawCurrency = String(raw.currency || "INR").trim().toUpperCase();
    const supportedCurrencies = ["INR", "USD", "EUR", "GBP"];
    if (!supportedCurrencies.includes(rawCurrency)) {
      anomalies.push({
        anomalyType: "MISSING_CURRENCY",
        severity: "WARNING",
        field: "currency",
        rawValue: rawCurrency,
        message: `Currency "${rawCurrency}" is not in the supported list (${supportedCurrencies.join(", ")}). Will default to INR unless overridden.`,
        requiresApproval: true,
      });
    }

    // ── Intra-CSV duplicate detection ─────────────────────────────────
    // Decision 39: highest priority anomaly test
    if (parsedDate && parsedAmount && rawPaidBy && desc) {
      const fingerprint = `${parsedDate.toISOString().slice(0, 10)}|${parsedAmount}|${rawPaidBy.toLowerCase()}|${desc.toLowerCase()}`;
      if (seenFingerprints.has(fingerprint)) {
        anomalies.push({
          anomalyType: "DUPLICATE_EXPENSE",
          severity: "ERROR",
          field: "row",
          rawValue: fingerprint,
          message: `This row appears to be a duplicate of another row in this CSV (same date, amount, payer, and description).`,
          requiresApproval: true,
        });
      } else {
        seenFingerprints.add(fingerprint);
      }
    }

    const hasErrors = anomalies.some((a) => a.severity === "ERROR");

    rows.push({
      rowNumber: i + 1,
      rawData: raw,
      anomalies,
      isClean: !hasErrors,
      suggestedTransactionType: txType,
      parsedDate,
      parsedAmount,
    });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Decision 19: Attempt to parse date, return ambiguity flag if DD-MM-YYYY is ambiguous */
function parseDate(raw: string): { date: Date | undefined; ambiguous: boolean } {
  const clean = raw.trim();

  // ISO format: YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
    return { date: isNaN(d.getTime()) ? undefined : d, ambiguous: false };
  }

  // DD-MM-YYYY or MM-DD-YYYY (ambiguous when day <= 12)
  const dashMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const a = parseInt(dashMatch[1]);
    const b = parseInt(dashMatch[2]);
    const year = parseInt(dashMatch[3]);
    // Assume DD-MM-YYYY (international convention)
    const d = new Date(`${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`);
    return {
      date: isNaN(d.getTime()) ? undefined : d,
      ambiguous: a <= 12, // ambiguous if both could be day or month
    };
  }

  // MM/DD/YYYY (US format)
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const d = new Date(`${slashMatch[3]}-${String(slashMatch[1]).padStart(2, "0")}-${String(slashMatch[2]).padStart(2, "0")}`);
    return { date: isNaN(d.getTime()) ? undefined : d, ambiguous: false };
  }

  return { date: undefined, ambiguous: false };
}
