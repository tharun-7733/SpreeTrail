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
