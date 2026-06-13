# Architectural Decisions

## CSV Import Pipeline
- **Decision:** The system will never silently fix data anomalies that affect financial totals or user attribution.
- **Rationale:** Financial data integrity is critical. Incorrect assumptions (like guessing missing payers or correcting >100% sums) lead to loss of trust.
- **Implementation:** The CSV import will be a multi-step wizard. Step 1: Parsing & Validation. Step 2: Anomaly Resolution (UI prompts user for missing data, corrections, alias mapping). Step 3: Final Import.

## Data Normalization
- **Decision:** Minor formatting issues (casing, trailing spaces, commas in numbers, >2 decimal places) will be auto-corrected during import without blocking the user.
- **Rationale:** Reduces friction for obvious typos that don't change the underlying meaning or mathematical correctness.

## Unknown Entities
- **Decision:** Unrecognized users in the CSV will trigger a mapping step where the user can either map them to an existing user (e.g., "Priya S" -> "Priya") or create a new guest member.
- **Rationale:** Prevents duplicate accounts and ensures balances remain accurate across different names for the same person.

---

## [2026-06-13] Section 1: Product Scope

### Decision 1: MVP Feature Priority
- **Decision:** The three mandatory MVP features are: (1) CSV Import with anomaly detection, (2) Correct balance calculation with membership change and multi-currency support, (3) Balance traceability.
- **Options considered:** UI polish, notifications, real-time updates.
- **Reason chosen:** These three features directly satisfy every named user requirement (Aisha, Priya, Rohan, Sam) and demonstrate engineering judgment more than visual design.
- **Tradeoffs:** UI will be functional but not premium. Acceptable because grading focuses on business logic and explainability.

### Decision 2: Multiple Groups
- **Decision:** The MVP supports multiple groups (e.g., Flat Expenses, Goa Trip).
- **Options considered:** Single shared group.
- **Reason chosen:** Real-world usage demands it, and a multi-group schema is cleaner and more correct than forcing all expenses into one namespace.
- **Tradeoffs:** Slightly more complex schema and API routing. No significant downside at this scale.

### Decision 3: Frontend Priority
- **Decision:** Backend correctness and business logic correctness are prioritized over visual polish. A functional, clean UI is sufficient.
- **Options considered:** Fully polished glassmorphism UI.
- **Reason chosen:** Grading criteria focus on DB design, anomaly handling, and the ability to explain decisions during a live interview.
- **Tradeoffs:** UI may look basic. Acceptable for internship grading context.

### Decision 4: Deployment Stack
- **Decision:** Vercel (frontend) + Neon PostgreSQL (database). Deploy early.
- **Reason chosen:** Already configured. Deploying early surfaces production issues before the deadline.
- **Tradeoffs:** Neon free tier has connection limits. Monitor for P1001 errors under load.

### Decision 5: Immutable Historical Data
- **Decision:** Imported expense records are never permanently deleted. Soft deletion via `deletedAt` column. Modification history is stored in an audit trail.
- **Options considered:** Hard delete, in-place edit.
- **Reason chosen:** Rohan's traceability requirement demands a full audit trail. If a balance can't be explained from source records, the system fails its core purpose. Also required by Meera's explicit rule: all modifications must be reviewable.
- **Tradeoffs:** Database grows over time. Queries must always filter `WHERE deletedAt IS NULL`. Every mutation requires explicit user approval before taking effect.

---

## [2026-06-13] Section 2: Authentication & Account Lifecycle

### Decision 6: Token Storage — HTTP-only Cookies
- **Decision:** JWTs are stored in HTTP-only cookies, not localStorage.
- **Options considered:** localStorage, sessionStorage, HTTP-only cookie.
- **Reason chosen:** HTTP-only cookies are inaccessible to JavaScript, eliminating the XSS token-theft attack surface. Financial data demands the safer approach.
- **Tradeoffs:** CSRF risk increases (mitigated by SameSite cookie attribute). Slightly more complex server-side cookie handling vs. simple `Authorization` header.

### Decision 7: No Refresh Tokens for MVP
- **Decision:** When a JWT expires, the user must re-authenticate. No silent refresh token flow.
- **Options considered:** Sliding sessions, refresh token rotation.
- **Reason chosen:** Simpler implementation, easier to explain and audit during a live interview. Reduced attack surface — refresh token theft is a real vulnerability.
- **Tradeoffs:** Users get logged out after token expiry. Documented as a known limitation.

### Decision 8: CSV Import Runs as Authenticated User
- **Decision:** The user importing the CSV is recorded as `importedByUserId` on the `ImportSession`. Payer attribution for each row always comes from the CSV `paid_by` column, never assumed from the importer.
- **Options considered:** Anonymous import, admin-only import, importer-as-payer.
- **Reason chosen:** Provides full traceability (who imported when) without corrupting historical payer data from the CSV.
- **Tradeoffs:** If the importer's account is deactivated, the import session record still holds a valid foreign key. Must handle deactivated-user references gracefully in queries.

### Decision 9: No Password Reset or Email Verification (MVP)
- **Decision:** Password reset and email verification are out of scope for MVP.
- **Options considered:** SendGrid/Resend email flows, OTP via phone.
- **Reason chosen:** Not required by assignment. Time is better spent on import logic and balance correctness.
- **Tradeoffs:** Users who forget passwords cannot recover their account without direct database intervention. Documented as a known limitation.

### Decision 10: User Soft-Deactivation (isActive flag)
- **Decision:** Users are never physically deleted. When a member leaves (e.g., Meera), `isActive` is set to `false`.
- **Options considered:** Hard delete, anonymization.
- **Reason chosen:** Deleting users would break foreign key references in historical expenses, settlements, and import sessions — directly violating the immutability principle.
- **Tradeoffs:** `isActive` gates new actions only (login, creating expenses, joining groups). It must **never** be used to filter historical balance or expense queries. Failure to enforce this boundary would silently corrupt historical balances.
- **Implementation note:** Balance calculation queries must JOIN on `userId`, never filter `WHERE users.isActive = true`.

---

## [2026-06-13] Section 3: Groups & Membership

### Decision 11: Membership Dates Live in GroupMember Table
- **Decision:** `joinedAt` and `leftAt` are columns on the `GroupMember` table, not on the `User` table.
- **Options considered:** Storing join date on User (global), storing on Group (flat-wide), storing on GroupMember (per group per user).
- **Reason chosen:** A user can join multiple groups at different times. Sam joins Flat Expenses on April 15 and Goa Trip on a different date. Storing dates on the User table would conflate unrelated memberships.
- **Tradeoffs:** Every query that needs to determine "was this user a member at expense date X?" must check `GroupMember.joinedAt <= expenseDate AND (GroupMember.leftAt IS NULL OR GroupMember.leftAt >= expenseDate)`.
- **Schema:**
  ```
  GroupMember: id, userId, groupId, role, joinedAt, leftAt, createdAt
  ```

### Decision 12: Inactive Member Enforcement — Hard Block in UI, Warn+Approve in Importer
- **Decision:** Two different enforcement modes depending on context.
  - Manual UI: Hard block. If Meera's `leftAt` is before the expense date, the frontend must not allow adding her as a participant. The API must also reject this with a 400 error.
  - CSV Importer: Detect anomaly, surface it, require explicit user approval before skipping or including the row. Never silently fix or silently reject.
- **Reason chosen:** Historical CSV data cannot always be hard-blocked — that would make the entire import fail for one bad row. But new expense creation has no such excuse and must enforce membership validity.
- **Tradeoffs:** This creates two code paths for the same logical rule. The rule (`leftAt` check) must be extracted into a shared utility to prevent drift between importer and UI logic.

### Decision 13: Group-Specific Membership
- **Decision:** Membership is per-group, not flat-wide.
  - `User → GroupMember → Group` (many-to-many via join table)
  - Dev can be in Goa Trip without being in Flat Expenses.
- **Options considered:** Flat-wide membership (all members share a single roster).
- **Reason chosen:** The CSV itself proves this — Dev appears in Goa Trip expenses but not in flat bills. Flat-wide membership would force incorrect roster assignments.
- **Tradeoffs:** Membership must be verified per group on every API call, not just per user.

### Decision 14: Guest Participants (No Login Required)
- **Decision:** One-time or temporary participants (e.g., "Dev's friend Kabir") are stored in a `GuestParticipant` table, not in the `User` table.
- **Options considered:** (a) Full user account for Kabir, (b) Guest record with no login, (c) Lump into Dev's share.
- **Reason chosen:** (b) preserves full traceability without polluting the authenticated User table. (c) loses traceability. (a) adds unnecessary credential complexity.
- **Tradeoffs:** The balance engine must query **both** `User` and `GuestParticipant` as valid participants on an expense. This means expense participant rows must use a polymorphic reference OR a nullable `guestParticipantId` alongside `userId`. Guest balances are informational only — they cannot log in to settle debts.
- **Schema:**
  ```
  GuestParticipant: id, name, groupId, createdByUserId, createdAt
  ExpenseParticipant: id, expenseId, userId (nullable), guestParticipantId (nullable), shareAmount
  ```
- **Constraint:** Exactly one of `userId` or `guestParticipantId` must be non-null per `ExpenseParticipant` row.

### Decision 15: Settlements Are Group-Scoped
- **Decision:** A settlement record is tied to a specific `groupId`. Settling a debt in "Flat Expenses" does not affect balances in "Goa Trip."
- **Options considered:** Cross-group global debt simplification.
- **Reason chosen:** Users expect each group's finances to be independently understandable. Cross-group settlement reduces transparency and makes debugging balances significantly harder.
- **Tradeoffs:** Rohan and Aisha may have offsetting balances across groups that remain separately visible. This is intentional — users can manually decide to handle cross-group offsets themselves.
- **Schema:**
  ```
  Settlement: id, groupId, payerId, receiverId, amount, currency, settledAt, notes, deletedAt
  ```

---

## [2026-06-13] Section 3 Addenda: Clarifications After Challenge

### Addendum to Decision 14: GuestParticipant Balance Normalization
- **Decision refined:** Two separate tables (`User` and `GuestParticipant`) are intentionally maintained. The extra query complexity is acceptable because guests are rare and the data modeling distinction is meaningful.
- **Options reconsidered:** A single unified Participant entity with nullable auth fields was evaluated and rejected — it trades modeling clarity for query simplicity, which is the wrong tradeoff for an assignment that will be explained in a live interview.
- **Implementation pattern:** At the data-access layer, both sources are normalized into a common in-memory structure before being passed to the balance engine:
  ```ts
  interface NormalizedParticipant {
    participantId: string;
    name: string;
    participantType: "USER" | "GUEST";
  }
  ```
  The balance engine operates exclusively on `NormalizedParticipant[]`. It has no knowledge of `User` vs `GuestParticipant` tables. This isolates the complexity to one layer.
- **Interview answer:** "The complexity is in the data access layer, not the business logic layer. The balance engine is clean."

### Addendum to Decision 12: Importer vs UI — Deliberate Separation of Responsibilities
- **Decision refined:** The two enforcement modes are not an inconsistency — they are a deliberate architectural separation based on fundamentally different responsibilities.
  - **Importer:** Handles historical data that already exists and may contain errors. Hard-blocking would prevent successful data migration. Policy = *preserve history, surface anomalies, require explicit review per row, continue import.*
  - **Manual UI:** Creates new data under our full control. There is no excuse for invalid states in new data. Policy = *validate before save, reject immediately, show clear error.*
- **The shared rule:** The membership validity check (`joinedAt <= expenseDate AND (leftAt IS NULL OR leftAt >= expenseDate)`) lives in a **single shared utility function** called by both the importer and the API route. The enforcement action differs; the rule does not.
- **Interview answer:** "Importer = preserve history and warn. UI = prevent bad data from being created. Same rule, different enforcement. Historical correction and future prevention are different responsibilities."

---

## [2026-06-13] Section 4: Expenses & Split Types

### Decision 16: Supported Split Types & Edit Mutability
- **Decision:** All four split types are supported for manual expense creation: `equal`, `unequal`, `percentage`, `share`.
- **Immutability rule for imported expenses:** Once imported, split type and amounts cannot be changed.
- **Mutability rule for manually created expenses:** An expense may be edited **until settlement activity exists that depends on it**. After that, it becomes immutable.
- **Open question (unresolved — prepare for interview):** "Depends on" requires a precise definition. Current working interpretation: an expense is locked if any settlement in the same group was recorded on or after the expense's creation date. This is a group-level lock, not expense-level. May need refinement.
- **Schema note:** `Expense` table needs `source` field: `MANUAL | IMPORTED` to enforce different mutability rules per source.

### Decision 17: Split Validation Rules
- **Percentage splits:** Sum of all participant percentages must fall within `99.9% ≤ total ≤ 100.1%`. Strict equality rejected due to floating-point rounding.
- **Share-based splits:** Every participant share must be positive (> 0). Total shares must be > 0. No negative shares permitted. Derived amounts = `(participant_share / total_shares) × total_amount`.
- **Equal splits:** Rounding remainder (from integer division) is added to the payer's share by default.
- **Unequal splits:** Explicit amounts per participant must sum to the total expense amount, within the same ±0.1 tolerance.

### Decision 18: Negative Amounts — Importer Only
- **Decision:** Negative amounts are valid only during CSV import (option b). The manual UI rejects negative values entirely.
- **Importer behavior:** Detect negative amount → mark row with `transactionType = REFUND` → preserve original amount → surface as anomaly → continue import without blocking.
- **UI behavior:** Reject negative values with a validation error. Future work may introduce a dedicated Refund transaction type in the UI.
- **Schema note:** `Expense` table needs `transactionType` column: `EXPENSE | REFUND`. Default is `EXPENSE`. Refunds are negative-amount rows from import only.

### Decision 19: Raw CSV Values Preserved Alongside Resolved Values
- **Decision:** When the importer resolves an anomaly (e.g., an ambiguous date), the original raw value from the CSV is always preserved. It is never overwritten.
- **Storage:** `ImportedExpenseRaw` table (or `rawData` JSONB column on `ImportSession` rows) stores original field values alongside the resolved values and the approver identity.
- **Format:**
  ```
  rawDate:        "04-05-2026"
  resolvedDate:   "2026-05-04"
  approvedBy:     userId
  approvedAt:     timestamp
  resolutionNote: "User confirmed DD-MM-YYYY format"
  ```
- **Reason:** Rohan's traceability requirement. Every correction must remain explainable from first principles. If a resolved date is ever questioned, the original raw value proves what the CSV actually said.

### Decision 20: Multi-Currency — User-Supplied Rate Per Import Session
- **Decision:** When the importer encounters a foreign currency (e.g., USD), it pauses and asks the user for an exchange rate. One rate per currency per import session.
- **Options considered:** (a) Live API rate, (b) user rate per session, (c) user rate per expense row, (d) separate currency balances.
- **Reason chosen:** (b) balances historical accuracy with user effort. Live rates (a) change post-import and make historical figures non-reproducible. Per-expense rates (c) are more accurate but create significant UX friction. Separate balances (d) prevent a unified debt graph, failing Aisha's requirement.
- **Storage per expense:**
  ```
  originalAmount:       84
  originalCurrency:     "USD"
  exchangeRate:         83.50   (user-supplied at import time)
  convertedAmountINR:   7014
  groupBaseCurrency:    "INR"
  ```
- **Display rule:** Both original and converted amounts are shown in the UI. Balance calculations use `convertedAmountINR` only.
- **Known limitation (flagged for interview):** All USD expenses in one import session share the same exchange rate, regardless of their individual dates. This is a documented approximation, not a bug.

---

## [2026-06-13] Section 5: CSV Import Pipeline

### Decision 21: Incremental Import — Row-by-Row, Not All-or-Nothing
- **Decision:** Import is session-based and incremental. Rows are written to domain tables individually as each anomaly is approved by the user. The full import does not block on unresolved rows.
- **Flow:** Parse CSV → Create `ImportedExpenseRaw` records → Detect anomalies per row → User resolves incrementally → Valid rows are committed as `Expense` or `Settlement` → Session tracks overall progress.
- **Options considered:** All-or-nothing (commit only after all anomalies resolved), batch-by-batch.
- **Reason chosen:** Prevents loss of progress on large imports. Unrelated clean rows are not blocked by one problematic row.
- **Tradeoffs:** Partial imports are a valid state. The UI must clearly communicate session progress (e.g., "32 of 43 rows committed, 4 anomalies pending").
- **Idempotency constraint (flagged for implementation):** Before committing a row, check if `ImportedExpenseRaw.createdEntityId` is already set. If it is, reject the duplicate write. This prevents double-committing if the user approves the same row twice.
- **Atomicity constraint (flagged for implementation):** Each row commit (creating `Expense` + its `ExpenseParticipant` rows) must be wrapped in a single database transaction. A partial write is worse than no write.

### Decision 22: Settlement-Disguised-as-Expense Routing
- **Decision:** If the importer detects a settlement row (e.g., Row 14 "Rohan paid Aisha back") and the user approves converting it, the final entity is written to the `Settlement` table — not the `Expense` table.
- **The `ImportedExpenseRaw` record is never deleted.** It is updated with:
  - `resolvedAs: SETTLEMENT` (not EXPENSE)
  - `createdEntityId`: the ID of the created `Settlement` record
  - `resolutionNote`: the user's approval reason
- **Schema note:** `ImportedExpenseRaw` needs a `resolvedAs` field: `EXPENSE | REFUND | SETTLEMENT | SKIPPED`. Without this, querying "how many rows became settlements" requires parsing anomaly text — which is fragile and wrong.
- **Interview answer:** "The CSV row always remains traceable. The `ImportedExpenseRaw` record is the permanent link between what the CSV said and what the database contains."

### Decision 23: Two Distinct Anomaly Categories — Identity vs Membership
- **Decision:** Name resolution anomalies and membership date anomalies are treated as separate anomaly types, surfaced differently to the user.
- **Identity anomaly (e.g., "Priya" vs "Priya S"):**
  - Question being answered: *"Who is this person?"*
  - User sees: original name from CSV, list of candidate user matches, option to create new user.
  - Resolution: map CSV name → existing user record.
  - `anomalyType: UNKNOWN_MEMBER`
- **Membership date anomaly (e.g., Meera in April after leaving March 31):**
  - Question being answered: *"Should this person participate at this date?"*
  - User sees: expense date, member join date, member leave date.
  - Resolution options: (a) remove participant from this expense, (b) override and mark as historical exception, (c) extend membership date to cover this expense.
  - `anomalyType: INACTIVE_MEMBER_AT_DATE`
- **Tradeoffs:** Two separate resolution UIs are needed. However, conflating them would confuse the user — choosing who someone *is* versus whether they *should be there* are completely different decisions.

### Decision 24: Import Session is Resumable
- **Decision:** An `ImportSession` persists all state server-side. If the user closes their browser, they return to the session and continue from where they left off.
- **`ImportSession` status enum:** `PARSING | ANOMALY_REVIEW | COMMITTING | COMPLETED | FAILED`
- **Progress tracking:** Session stores `totalRows`, `rowsCommitted`, `rowsSkipped`, `rowsPendingReview`.
- **Reason:** Large CSV files may have many anomalies. Requiring a restart from scratch would be unacceptable UX and would risk data consistency problems.
- **Schema update:**
  ```
  ImportSession: id, groupId, importedByUserId, filename, status,
                 totalRows, rowsCommitted, rowsSkipped, rowsPendingReview,
                 createdAt, completedAt
  ```

### Decision 25: Import Report is Computed on Demand — No Separate Table
- **Decision:** The Import Report is derived by querying `ImportSession` + `ImportedExpenseRaw`. It is not stored as a separate table or document.
- **Reason chosen:** A stored report can go stale if underlying data is updated. Computing on demand guarantees the report always reflects the current state.
- **Interview answer:** *"The report is computed on demand. I join `ImportSession` and `ImportedExpenseRaw`. Every field in the report maps to a column I already store. No duplication."*
- **Report fields (derived):**

| Field | Source |
|---|---|
| importSessionId | ImportSession.id |
| importedBy | ImportSession.importedByUserId → User.name |
| importedAt | ImportSession.createdAt |
| fileName | ImportSession.filename |
| totalRows | ImportSession.totalRows |
| rowsImported | COUNT(ImportedExpenseRaw WHERE resolvedAs IN [EXPENSE, REFUND]) |
| rowsSkipped | COUNT(ImportedExpenseRaw WHERE resolvedAs = SKIPPED) |
| rowsConvertedToSettlements | COUNT(ImportedExpenseRaw WHERE resolvedAs = SETTLEMENT) |
| rowsPendingReview | COUNT(ImportedExpenseRaw WHERE status = PENDING) |
| totalAnomalies | COUNT(anomaly records across all rows) |
| per-row: originalCSVData | ImportedExpenseRaw.rawData |
| per-row: detectedIssue | ImportedExpenseRaw.anomalies |
| per-row: actionTaken | ImportedExpenseRaw.resolvedAs + resolutionNote |
| per-row: approvedBy | ImportedExpenseRaw.approvedBy → User.name |
| per-row: resultingEntityId | ImportedExpenseRaw.createdEntityId |
| currency details | Expense.originalCurrency, exchangeRate, convertedAmountINR |
| identity resolution | anomaly record: originalName → resolvedUserId |
| membership details | anomaly record: expenseDate, memberJoinDate, memberLeaveDate |

---

## [2026-06-13] Section 6: Balance Calculation

### Decision 26: Balance Computation Formula
- **Decision:** For each expense, each participant's net contribution is computed as:
  `netContribution = amountPaid - shareAmount`
  Positive = owed money back. Negative = owes money.
- **Group balance** = sum of all `netContribution` values per user across all valid expenses.
- **Worked example (confirmed correct):**
  - Rent ₹4000 / 3 → Aisha net +₹2666.67, Rohan net -₹1333.33, Priya net -₹1333.33
  - WiFi ₹1200 / 2 → Aisha net -₹600, Rohan net +₹600
  - Final: Aisha +₹2066.67, Rohan -₹733.33, Priya -₹1333.33
  - Rohan owes Aisha ₹733.33. Priya owes Aisha ₹1333.33.
- **Currency note:** All amounts use `convertedAmountINR` for calculation. Original currency displayed alongside.

### Decision 27: Membership Filter Lives in SQL, Not Application Code
- **Decision:** The membership validity check — `joinedAt ≤ expenseDate AND (leftAt IS NULL OR leftAt ≥ expenseDate)` — is applied in the SQL query as a JOIN condition, not in application code.
- **Options considered:** Post-fetch filter in application code, SQL WHERE clause.
- **Reason chosen:** SQL filtering prevents invalid rows from ever being loaded into memory. It is also the only way to guarantee consistency — application-layer filtering can be silently skipped or miscoded in a different code path.
- **Sam's rule:** Sam automatically has no balance contribution for February or March expenses because no `GroupMember` record for Sam satisfies `joinedAt ≤ February expense date`.
- **Interview answer:** "Sam's late-join is not a special case. It is a natural consequence of the membership window query. The SQL handles it universally."

### Decision 28: Debt Simplification for the Final Debt Graph
- **Decision:** The final debt graph presented to users (Aisha's view) is simplified using a minimum-transaction algorithm. Pairwise debts that can be cancelled through a third party are merged.
- **Options considered:** Raw pairwise balances only (no simplification).
- **Reason chosen:** Aisha's requirement is "one answer: who pays whom." Simplified graph reduces the number of transactions required to settle the group.
- **Critical constraint:** Simplification applies **only to the final presentation layer**. All underlying expense records, participant shares, and pairwise balances remain unchanged.
- **Traceability preserved:** Rohan's breakdown view is computed from raw pairwise balances, not from the simplified graph. The two views are independent:
  - Simplified graph → answers "who pays whom?" (Aisha's view)
  - Expense breakdown → answers "why?" (Rohan's view)
- **Interview answer:** "Debt simplification is a display transformation. It does not touch the database. I can always recompute raw balances from scratch and the simplified result follows."

### Decision 29: Settlements Applied Dynamically at Query Time
- **Decision:** Settlements are subtracted from raw expense-derived balances at query time. They never modify expense records.
- **Formula:** `currentBalance = rawExpenseBalance - settlementsReceived + settlementsPaid`
- **Options considered:** Mutating expense records to reflect settlements, storing a running balance.
- **Reason chosen:** Expense immutability is non-negotiable (Decision 5, 16). Storing a running balance violates the audit trail — if an expense is soft-deleted, the running balance becomes wrong.
- **Interview answer:** "Settlements are just another signed input to the balance formula. Expenses are facts. Settlements are facts. The current balance is derived from both, at read time, every time."

### Decision 30: Balance Traceability Response — Full Breakdown Including Settlements
- **Decision:** The balance traceability API returns both the expense breakdown and the settlements applied, so that `sum(breakdown) - sum(settlements) == totalOwed`. Without settlements in the response, the numbers would not reconcile.
- **Response structure:**
  ```ts
  {
    userId: string,
    counterpartyId: string,
    totalOwed: number,           // current balance after settlements
    rawBalance: number,          // balance from expenses only
    expenseBreakdown: [
      {
        expenseId: string,
        expenseTitle: string,
        expenseDate: string,
        paidBy: string,
        originalAmount: number,
        originalCurrency: string,
        exchangeRate: number,
        convertedAmount: number,
        participantShare: number,
        netImpact: number        // positive = owed back, negative = owes
      }
    ],
    settlementsApplied: [
      {
        settlementId: string,
        settledAt: string,
        amount: number,
        direction: "PAID" | "RECEIVED"
      }
    ]
  }
  ```
- **Interview answer:** "The breakdown satisfies Rohan's requirement. `rawBalance` minus `settlementsApplied` equals `totalOwed`. Every number is traceable to a source record."

---

## [2026-06-13] Section 6 Addendum: Balance Traceability Endpoint

### Decision 31: Dedicated Endpoint for Balance Breakdown
- **Decision:** Balance traceability uses a dedicated endpoint separate from the main balances route.
  - `GET /api/groups/:groupId/balances` → summary debt graph (Aisha's view)
  - `GET /api/groups/:groupId/balances/:userId/breakdown` → per-expense breakdown (Rohan's view)
- **Options considered:** Including breakdown in the main balances response, query parameter toggle.
- **Reason chosen:** Separation of concerns. The summary endpoint is cheap and called on every group page load. The breakdown is expensive (full expense JOIN) and only needed when a user explicitly clicks "why do I owe this?" Merging them would force every user to pay Rohan's query cost on every load.
- **Tradeoffs:** Two endpoints to document and maintain. Justified by the significant difference in query complexity and call frequency.

---

## [2026-06-13] Section 7: API Design

### Decision 32: Complete Route Inventory

**Auth routes:**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

**Group routes:**
```
POST   /api/groups
GET    /api/groups
GET    /api/groups/:groupId                         ← authenticated members only
GET    /api/groups/:groupId/preview                 ← public (invite preview)
POST   /api/groups/:groupId/join
POST   /api/groups/:groupId/members                 ← add member (admin)
DELETE /api/groups/:groupId/members/:memberId       ← remove member (admin)
```

**Expense routes:**
```
GET    /api/groups/:groupId/expenses
POST   /api/groups/:groupId/expenses
DELETE /api/groups/:groupId/expenses/:expenseId
```

**Balance routes:**
```
GET    /api/groups/:groupId/balances
GET    /api/groups/:groupId/balances/:userId/breakdown
```

**Settlement routes:**
```
GET    /api/groups/:groupId/settlements
POST   /api/groups/:groupId/settlements
```

**Import routes (ordered by call sequence):**
```
POST   /api/imports                                 ← create session
POST   /api/imports/:sessionId/upload               ← upload CSV, parse rows
GET    /api/imports/:sessionId                      ← session status + progress
GET    /api/imports/:sessionId/issues               ← list anomalies
PATCH  /api/imports/:sessionId/issues/:issueId      ← resolve one anomaly
POST   /api/imports/:sessionId/complete             ← commit approved rows
GET    /api/imports/:sessionId/report               ← full import report
```

### Decision 33: POST /api/groups/:groupId/expenses — Request Body Contract
- **Decision:** The request body supports all four split types through a polymorphic `participants` array.
- **Request body:**
  ```ts
  {
    title: string,
    description?: string,
    amount: number,
    currency: string,
    exchangeRate?: number,       // required if currency != group base currency
    expenseDate: string,         // ISO 8601: "2026-03-09"
    paidByUserId: string,
    splitType: "EQUAL" | "UNEQUAL" | "PERCENTAGE" | "SHARE",
    participants: [
      {
        participantId: string,
        participantType: "USER" | "GUEST",
        amount?: number,         // required for UNEQUAL
        percentage?: number,     // required for PERCENTAGE
        shares?: number          // required for SHARE; must be > 0
      }
    ]
  }
  ```
- **Server-side validation requirements:**
  - `EQUAL`: participant-level fields ignored; server divides evenly.
  - `UNEQUAL`: sum of `amount` fields must equal total `amount` ± 0.1.
  - `PERCENTAGE`: sum of `percentage` fields must be 99.9–100.1%.
  - `SHARE`: all `shares` > 0.
  - `GUEST` participants: `participantId` must reference a `GuestParticipant` with `groupId` matching this request. Cross-group guest assignment rejected with 400.
  - Membership check: every `USER` participant must satisfy `joinedAt <= expenseDate AND (leftAt IS NULL OR leftAt >= expenseDate)`.

### Decision 34: GET /api/groups/:groupId/balances — Response Shape
- **Decision:** Returns simplified debt graph + raw net-per-user positions. Pairwise raw breakdown reserved for the dedicated breakdown endpoint.
- **Response:**
  ```ts
  {
    simplifiedDebts: [
      { fromUserId: string, fromUserName: string, toUserId: string, toUserName: string, amount: number, currency: string }
    ],
    rawNetBalances: [
      { userId: string, userName: string, netBalance: number }
    ]
  }
  ```
- **Clarification:** `rawNetBalances` is net-per-user (not pairwise). Answers "is Rohan net positive or negative?" Pairwise "who owes whom specifically" comes from the breakdown endpoint.

### Decision 35: Import Pipeline Route Sequencing

| Step | Route | Purpose |
|---|---|---|
| 1 | `POST /api/imports` | Creates `ImportSession`, returns `sessionId` |
| 2 | `POST /api/imports/:sessionId/upload` | Uploads CSV, parses rows, creates `ImportedExpenseRaw`, runs anomaly detection |
| 3 | `GET /api/imports/:sessionId` | Returns session status and progress counters |
| 4 | `GET /api/imports/:sessionId/issues` | Returns unresolved anomalies with resolution context |
| 5 | `PATCH /api/imports/:sessionId/issues/:issueId` | Resolves a single anomaly |
| 6 | `POST /api/imports/:sessionId/complete` | Commits all approved rows; skips SKIPPED rows |
| 7 | `GET /api/imports/:sessionId/report` | Returns full computed Import Report (derived, not stored) |

- **Session resumability:** Steps 3–5 can be called repeatedly. Closing the browser and returning restores state via step 3.
- **Idempotency:** Step 6 checks `ImportedExpenseRaw.createdEntityId` before writing. Already-committed rows are skipped without error.
- **Note:** `POST /api/imports/:sessionId/upload` (step 2) was omitted from the initial missing-routes list in Q1 — this is corrected here. It is not optional.

### Decision 36: Standardised Error Response Shape
- **Decision:** All API routes return a consistent error envelope.
- **Error shape:**
  ```ts
  { success: false, code: string, message: string, details?: any, timestamp: string }
  ```
- **Success shape:**
  ```ts
  { success: true, data: any }
  ```
- **Standard error codes (non-exhaustive):**
  ```
  UNAUTHORIZED                   → 401
  FORBIDDEN                      → 403
  NOT_FOUND                      → 404
  INVALID_SPLIT_AMOUNTS          → 400
  INVALID_PERCENTAGE_SPLIT       → 400
  INACTIVE_MEMBER                → 400
  MEMBERSHIP_DATE_CONFLICT       → 400
  DUPLICATE_EXPENSE_DETECTED     → 409
  IMPORT_SESSION_NOT_FOUND       → 404
  IMPORT_ROW_ALREADY_COMMITTED   → 409
  INTERNAL_ERROR                 → 500
  ```
- **Reason:** Machine-readable `code` field enables specific frontend error messages without string parsing. `details` provides debuggable context. Consistent shape eliminates special-case handling in API client code.
- **Current state:** Existing routes return raw data without a `success` wrapper. Standardisation required before the CSV import feature is built on top.
