# Project Scope
_Last updated: 2026-06-13_

## MVP Features (Confirmed)
These are the three mandatory features for the first demo, prioritized by engineering impact:

1. **CSV Import with anomaly detection** — multi-step wizard; never silently fixes data; surfaces every anomaly for user approval.
2. **Correct balance calculation** — supports membership join/leave dates, multi-currency (INR + USD at minimum), and Sam's late-join rule (no inherited prior expenses).
3. **Balance traceability** — every balance figure must be explainable as a sum of specific expense rows (required by Rohan).

## Also In Scope
- Multiple groups (e.g., Flat Expenses, Goa Trip).
- Group membership management (join date, leave date tracked per member).
- Settlement tracking between members (partial and full).
- Soft deletion with audit trail — `deletedAt` column; nothing is permanently destroyed.
- Shareable invite links for group membership.
- Guest user handling (e.g., "Dev's friend Kabir") via `GuestParticipant` table — no login required.
- Multi-currency support: user-supplied exchange rate per currency per import session. Both original and converted amounts stored.

## Out of Scope
- Automatic currency conversion using live exchange rates.
- Silent autocorrection of any critical financial data during CSV import.
- Real-time updates / WebSockets.
- Mobile app or native notifications.
- Exporting reports or re-exporting CSV.
- Refund transaction type in the manual UI (future work — importer only for MVP).

## Data Integrity Rules
- Historical expense records are immutable after import.
- Manually created expenses are editable until settlement activity exists in the group.
- All modifications require explicit user approval.
- Modification history is stored in a separate audit table.
- Queries must always filter `WHERE deletedAt IS NULL` to exclude soft-deleted records.
- `isActive` on `User` gates new actions only — never used in historical balance queries.

## Anomaly Log (CSV Data Problems & Handling)
The CSV import pipeline is designed to never silently fix critical financial data. The following anomalies were anticipated and handled:
1. **Duplicate Expenses**: Detected via identical date, amount, and payer (e.g., Row 5 vs 6). Handling: Flagged for user approval; user must explicitly skip or approve.
2. **Negative Amounts**: Detected when amount < 0 (e.g., Row 26). Handling: Row is converted to `TransactionType.REFUND` with a positive absolute amount.
3. **Invalid Percentage Sums**: Detected when percentages do not equal 100% ± 0.1% (e.g., Row 15, 32). Handling: Blocked from import. User is prompted to adjust percentages in the review UI until they sum to 100%.
4. **Unknown Members**: Detected when names in `paid_by` or `split_with` don't map to registered users (e.g., "Dev's friend Kabir", "Priya S"). Handling: Prompt user to either map to an existing user or create a `GuestParticipant`.
5. **Settlements as Expenses**: Detected when notes explicitly say "settlement" or when an expense has 0 participants (e.g., Row 14). Handling: Reclassified and saved to the `Settlement` table instead of `Expense`.
6. **Ambiguous Dates**: Detected when date format isn't standard `DD-MM-YYYY` (e.g., "Mar-14", "04-05-2026"). Handling: Flagged for manual date verification by the user.
7. **Missing Currency**: Empty currency fields (e.g., Row 28). Handling: Flagged. Defaulted to the group's base currency, but user must confirm.
8. **Inactive Member inclusion**: Detected if a member is in a split but their `leftAt` date is prior to the expense date (e.g., Meera in April). Handling: Flagged for user to confirm if they should still pay or if the split should be recalculated.
9. **Zero Amounts**: Detected when amount is 0 (e.g., Row 31). Handling: Flagged. Usually skipped by the user.
10. **Mismatching Split Type & Details**: Detected if `split_type` is `equal` but `split_details` provides shares (e.g., Row 42). Handling: Flagged. User must choose which field to trust.

## Split Validation Rules
| Split Type  | Validation Rule |
|-------------|-----------------|
| equal       | Amount divided evenly; rounding remainder goes to payer |
| unequal     | Participant amounts must sum to total ± 0.1 |
| percentage  | Participant percentages must sum to 99.9–100.1% |
| share       | All shares > 0; amounts derived proportionally |

## Current Schema (Evolving)

```
User               → id, name, email, passwordHash, avatarUrl, isActive, createdAt
Group              → id, name, description, baseCurrency, createdByUserId, createdAt
GroupMember        → id, userId, groupId, role, joinedAt, leftAt, createdAt
GuestParticipant   → id, name, groupId, createdByUserId, createdAt
Expense            → id, groupId, description, amount, currency, originalAmount, originalCurrency,
                     exchangeRate, convertedAmountINR, paidById, splitType, transactionType,
                     source, date, createdById, deletedAt, createdAt
                     [transactionType: EXPENSE | REFUND]
                     [source: MANUAL | IMPORTED]
ExpenseParticipant → id, expenseId, userId (nullable), guestParticipantId (nullable), shareAmount
                     [CONSTRAINT: exactly one of userId or guestParticipantId is non-null]
Settlement         → id, groupId, payerId, receiverId, amount, currency, settledAt, notes, deletedAt
ImportSession      → id, groupId, importedByUserId, filename, status, createdAt
ImportedExpenseRaw → id, importSessionId, rowNumber, rawData (JSONB), resolvedData (JSONB),
                     anomalies (JSONB), approvedBy, approvedAt, resolutionNote, status
                     [status: PENDING | APPROVED | SKIPPED]
```
