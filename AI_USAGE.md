# AI Usage Log — Spreetail Assignment
_Maintained by: Tharun (engineer of record)_
_Last updated: 2026-06-13_

This file tracks how AI tools were used during this project, including specific mistakes the AI made, how they were discovered, and how they were corrected. This demonstrates that AI output was reviewed critically rather than accepted blindly.

---

## AI Tools Used

| Tool | Purpose |
|---|---|
| Antigravity (Gemini/Claude) | Architecture interviews, documentation, code generation, debugging |

---

## Key Prompts Used

1. Master prompt establishing rules: interview-first, no silent decisions, maintain DECISIONS.md/SCOPE.md/AI_USAGE.md.
2. Section-by-section interview prompts for: Product Scope, Auth, Groups, Expenses, CSV Import, Balances.
3. CSV anomaly analysis: "Analyze expenses_export.csv, detect every anomaly, never silently fix data."
4. Investigate and fix all request failures throughout the website to ensure all features function correctly."

---

## Documented AI Mistakes

### Mistake #1: AI Suggested Silent Duplicate Removal

**What the AI did:**
When analyzing the CSV, the AI initially proposed that duplicate rows (e.g., Row 5 and Row 6 — the two "dinner at Marina Bites" entries) could be automatically removed or merged during import.

**Why this was wrong:**
Meera's explicit requirement is that all modifications must be reviewable and no changes should happen without user approval. Silent removal of duplicates violates this requirement and removes the user's ability to audit what happened during import.

**How I discovered it:**
Re-reading Meera's requirement in the product context after seeing the initial suggestion.

**How I corrected it:**
Changed the import pipeline to: detect duplicate → mark as anomaly → surface to user with both rows visible → require explicit approval before skipping either row. The `ImportedExpenseRaw` record preserves both the original data and the resolution decision.

**Impact:** Drove Decisions 21–25 on the incremental import pipeline and anomaly review workflow.

---

### Mistake #2: AI Initially Ignored Membership Dates in Balance Calculations

**What the AI did:**
In early implementation attempts, the balance calculation queried all `ExpenseParticipant` rows for a group without filtering by membership dates. This meant Sam would have been included in February and March expense calculations even though he joined in April.

**Why this was wrong:**
Sam's explicit requirement is that he should not inherit expenses from before his joining date. Including him in pre-April balances would show him owing money he was never part of.

**How I discovered it:**
Tracing through Sam's scenario manually during the interview: "Sam joins April 15. February rent row has Sam in the balance query. That's wrong."

**How I corrected it:**
Added the membership window JOIN condition to all balance queries:
`GroupMember.joinedAt <= expense.date AND (GroupMember.leftAt IS NULL OR GroupMember.leftAt >= expense.date)`

This filter lives in SQL (Decision 27), not application code, so it cannot be accidentally bypassed. The `joinedAt`/`leftAt` columns were moved to the `GroupMember` table (Decision 11) to support per-group membership dates.

**Impact:** Drove Decisions 11 and 27. Also clarified that `isActive` on `User` must never be used in historical balance queries (Decision 10 addendum).

---

### Mistake #3: AI Generated an Unauthenticated Invite Page That Called a Protected API

**What the AI did:**
When implementing the shareable group invite feature, the AI built the invite landing page (`/invite/[groupId]`) to fetch group details by calling `GET /api/groups/[groupId]`. This API route required authentication.

**Why this was wrong:**
When a user who is not yet a member of the group — or not yet registered — clicks an invite link, they are unauthenticated. The authenticated API route returned a 401 Unauthorized error, and the invite page displayed "Invalid URL" instead of the group name and join button. The invite feature was completely broken for its primary use case.

**How I discovered it:**
Testing the invite link in a second browser account that was not logged in. The page showed "Invalid URL" immediately.

**How I corrected it:**
Created a separate public preview endpoint: `GET /api/groups/[groupId]/preview`. This endpoint returns only the minimal safe information needed for the invite page (group name, description, member count) — no expense data, no member list, no financial information. The original authenticated route remains unchanged and continues to protect sensitive data. The invite page now calls the preview endpoint first, and only the "Join Group" button calls the authenticated join endpoint.

**Impact:** Established the principle that public-facing pages must never call authenticated-only APIs. Any endpoint accessible to unauthenticated users must be explicitly designed and audited for what data it exposes.

---

## AI Mistakes Still Being Monitored

- The balance simplification algorithm (debt minimization) has not yet been implemented. If the AI generates an incorrect minimum-transaction algorithm, the simplified debt graph will show wrong numbers. To be verified with manual test cases using the CSV data.
- The `ImportedExpenseRaw` JSONB structure has not been implemented yet. If the AI generates a schema that stores anomaly data differently from what is documented in DECISIONS.md, it must be caught and corrected before import logic is built on top of it.

---

## Engineering Principles Followed

1. Every AI code suggestion was reviewed before being committed.
2. AI-generated architecture decisions were challenged with explicit "why" questions.
3. Where AI suggestions conflicted with named user requirements, the requirements always won.
4. All corrections are documented here with the reasoning, not just the fix.
