# BUILD_PLAN.md — Spreetail (Splitwise MVP)

> Generated from: `AI_CONTEXT.md` (Round 1 confirmed; Round 2 partially confirmed)
> Last updated: 2026-06-13
> Status: **In progress** — Auth APIs built; remaining routes, frontend, and deployment pending.

---

## 1. Product Research

### Splitwise Workflows Studied

The following core Splitwise workflows were reverse-engineered and scoped for the MVP:

| # | Workflow | In MVP |
|---|---|---|
| 1 | User registration and login | ✅ |
| 2 | Creating groups and managing members | ✅ |
| 3 | Adding shared expenses | ✅ |
| 4 | Splitting expenses: equally, unequally, by percentage, by shares | ✅ |
| 5 | Viewing group balances and personal summaries | ✅ |
| 6 | Recording settlements / payments | ✅ |
| 7 | Expense-specific comments / chat | ✅ |
| 8 | Currency conversion | ❌ Out of scope |
| 9 | Email notifications | ❌ Out of scope |
| 10 | Recurring expenses | ❌ Out of scope |
| 11 | Attachments / receipt scanning | ❌ Out of scope |
| 12 | Analytics and advanced reports | ❌ Out of scope |

### Splitwise Design Observations

- Splitwise stores **per-user debt** on each expense via a participant list — not raw pairwise debts.
- Balances are displayed as **net totals**, simplified across all expenses in a group.
- The "settle up" flow is a manual action: a user records "I paid X person Y amount."
- Groups are the primary organizational unit. Users can belong to multiple groups.
- Comments are attached to individual expenses, not the group.

### Assumptions Made

The following decisions were made due to incomplete interview rounds. Each is labeled with its ID and must be confirmed or overridden before the project is considered complete.

| ID | Assumption | Source |
|---|---|---|
| A1 | Auth: email + password only. JWT stored in httpOnly cookie. 7-day expiry. No social login. | AI default |
| A2 | Group roles: ADMIN (creator) and MEMBER. Only ADMIN can remove members or delete group. | AI default |
| A3 | Single payer per expense. Exactly one person paid the full bill. | AI default |
| A4 | All four split types supported: EQUAL, UNEQUAL, PERCENTAGE, SHARES. | AI_CONTEXT.md §5 |
| A5 | EQUAL split divides only among selected participants, not all group members automatically. | AI default |
| A6 | Settlements are manually recorded by any group member. They directly reduce the outstanding balance. No "settlement expense" pattern. | AI default |
| A7 | Users can pick currency per expense. No conversion logic. | **User confirmed** |
| A8 | Hard deletes only. No soft-delete for MVP. | AI default |
| A9 | Comment editing not supported for MVP — insert only. | AI default |

---

## 2. Architecture

### Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Full-stack in one repo; file-based API routing |
| Language | TypeScript | Type safety; maintainability for recruiter review |
| ORM | Prisma | Type-safe DB access; schema-first; auto-migrations |
| Database | PostgreSQL | Relational data model required; strong referential integrity |
| Auth | bcrypt + jose (JWT) | No external auth dependency; httpOnly cookies for security |
| Validation | Zod | Schema-level validation co-located with route handlers |
| Styling | Vanilla CSS / CSS Modules | No framework overhead; full control |
| Deployment | Vercel (app) + Supabase or Neon (DB) | Zero-config Next.js deploy; free-tier PostgreSQL |

### Database Schema

**Source file:** `prisma/schema.prisma`

#### Entity Relationship Summary

```
User ─┬── creates ──► Group
      ├── belongs to ──► GroupMember (junction: User × Group)
      ├── pays ──► Expense
      ├── owes share in ──► ExpenseParticipant
      ├── records ──► Settlement
      └── writes ──► ExpenseComment

Group ─┬── has many ──► GroupMember
       ├── has many ──► Expense
       └── has many ──► Settlement

Expense ─┬── has many ──► ExpenseParticipant
          └── has many ──► ExpenseComment
```

#### Tables

| Table | Primary Key | Key Columns | Constraints |
|---|---|---|---|
| `users` | UUID | email (unique), passwordHash, name, avatarUrl? | — |
| `groups` | UUID | name, description?, createdById (FK→users) | — |
| `group_members` | UUID | groupId (FK), userId (FK), role (ADMIN\|MEMBER), joinedAt | UNIQUE(groupId, userId) |
| `expenses` | UUID | groupId, paidById, createdById, amount (Decimal 12,2), currency, splitType, date | — |
| `expense_participants` | UUID | expenseId, userId, shareAmount, sharePercentage?, shareUnits? | UNIQUE(expenseId, userId) |
| `settlements` | UUID | groupId, payerId, receiverId, amount, note?, settledAt | — |
| `expense_comments` | UUID | expenseId, userId, content | — |

#### Key Design Decisions

- **Balances are never stored.** They are computed at query time:
  `balance(A→B) = SUM(shareAmount where userId=A, paidById=B) − SUM(settlements where payerId=A, receiverId=B)`
- **`shareAmount` is always pre-computed** and written at expense creation time regardless of split type. Balance queries are a simple `SUM` — no runtime arithmetic.
- **`onDelete: Cascade`** on all child relations ensures no orphan rows.
- **`Decimal(12,2)`** on all monetary fields avoids floating-point errors.
- **UUIDs** as primary keys for all tables.

---

### API Design

Base path: `/api`

#### Auth

| Method | Route | Purpose | Auth required |
|---|---|---|---|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login, sets JWT cookie | No |
| GET | `/api/auth/me` | Get current user profile | Yes |
| POST | `/api/auth/logout` | Clear session cookie | Yes |

#### Groups

| Method | Route | Purpose | Auth required |
|---|---|---|---|
| GET | `/api/groups` | List groups for current user | Yes |
| POST | `/api/groups` | Create a new group | Yes |
| GET | `/api/groups/[groupId]` | Get group details | Yes, member |
| PATCH | `/api/groups/[groupId]` | Update group name/description | Yes, ADMIN |
| DELETE | `/api/groups/[groupId]` | Delete group | Yes, ADMIN |

#### Members

| Method | Route | Purpose | Auth required |
|---|---|---|---|
| GET | `/api/groups/[groupId]/members` | List group members | Yes, member |
| POST | `/api/groups/[groupId]/members` | Add member by email | Yes, ADMIN |
| DELETE | `/api/groups/[groupId]/members/[userId]` | Remove member | Yes, ADMIN |

#### Expenses

| Method | Route | Purpose | Auth required |
|---|---|---|---|
| GET | `/api/groups/[groupId]/expenses` | List expenses for a group | Yes, member |
| POST | `/api/groups/[groupId]/expenses` | Add expense with participant split | Yes, member |
| GET | `/api/groups/[groupId]/expenses/[expenseId]` | Get expense detail | Yes, member |
| PATCH | `/api/groups/[groupId]/expenses/[expenseId]` | Edit expense | Yes, creator or ADMIN |
| DELETE | `/api/groups/[groupId]/expenses/[expenseId]` | Delete expense | Yes, creator or ADMIN |

#### Balances

| Method | Route | Purpose | Auth required |
|---|---|---|---|
| GET | `/api/groups/[groupId]/balances` | Compute net balances for all members in group | Yes, member |

#### Settlements

| Method | Route | Purpose | Auth required |
|---|---|---|---|
| GET | `/api/groups/[groupId]/settlements` | List settlements in group | Yes, member |
| POST | `/api/groups/[groupId]/settlements` | Record a settlement | Yes, member |
| DELETE | `/api/groups/[groupId]/settlements/[settlementId]` | Delete a settlement | Yes, recorder or ADMIN |

#### Comments

| Method | Route | Purpose | Auth required |
|---|---|---|---|
| GET | `/api/groups/[groupId]/expenses/[expenseId]/comments` | List comments on expense | Yes, member |
| POST | `/api/groups/[groupId]/expenses/[expenseId]/comments` | Add a comment | Yes, member |

---

### Balance Calculation Logic

For a given group, the net balance between every pair of users is:

```
For each unique pair (A, B):

  A_owes_B = SUM of expense_participants.shareAmount
             WHERE expense_participants.userId = A
             AND expenses.paidById = B

  A_paid_B = SUM of settlements.amount
             WHERE settlements.payerId = A
             AND settlements.receiverId = B

  net(A→B) = A_owes_B − A_paid_B
```

If `net(A→B) > 0`, A still owes B money.
If `net(A→B) < 0`, A has overpaid (B owes A).

The API computes this for all pairs in the group and returns a normalized list.

---

### Frontend Structure

> ⚠️ Frontend architecture was not fully decided in the interview. The structure below is based on reasonable Next.js conventions for the App Router.

```
app/
  (auth)/
    login/
      page.tsx            ← Login screen
    register/
      page.tsx            ← Registration screen
  (app)/
    layout.tsx            ← Authenticated shell with sidebar/nav
    dashboard/
      page.tsx            ← Summary of all groups + total balances
    groups/
      page.tsx            ← Groups list
      new/
        page.tsx          ← Create group
      [groupId]/
        page.tsx          ← Group detail: members, expenses, balances
        expenses/
          new/
            page.tsx      ← Add expense form
          [expenseId]/
            page.tsx      ← Expense detail + comments
        settlements/
          new/
            page.tsx      ← Record settlement form
  api/                    ← Backend routes (see API Design)
  layout.tsx              ← Root layout
  page.tsx                ← Landing / redirect

components/
  ui/                     ← Reusable atoms: Button, Input, Modal, Badge
  groups/                 ← GroupCard, GroupList, MemberChip
  expenses/               ← ExpenseRow, ExpenseForm, SplitTypeSelector
  balances/               ← BalanceSummary, DebtArrow
  settlements/            ← SettlementForm, SettlementHistory
  comments/               ← CommentThread, CommentInput

lib/
  prisma.ts               ← Prisma client singleton
  auth.ts                 ← JWT sign/verify/session helpers

hooks/
  useAuth.ts              ← Current user context
  useGroup.ts             ← Group data + mutations
  useExpenses.ts          ← Expense data + mutations

types/
  index.ts                ← Shared TypeScript types
```

---

### Deployment Strategy

| Component | Platform | Notes |
|---|---|---|
| App (Next.js) | Vercel | Zero-config; free tier; automatic CI/CD from GitHub |
| Database (PostgreSQL) | Supabase or Neon | Free-tier managed PostgreSQL; compatible with Prisma |
| Environment Variables | Vercel Dashboard | `DATABASE_URL`, `JWT_SECRET` |
| Branch strategy | `master` → production | Single branch for MVP; no staging environment |

**Steps to deploy:**
1. Push code to GitHub (`master` branch).
2. Connect GitHub repo to Vercel project.
3. Add `DATABASE_URL` and `JWT_SECRET` to Vercel environment variables.
4. Run `npx prisma migrate deploy` in Vercel build step or manually against production DB.
5. Vercel auto-builds and deploys on every push.

---

## 3. AI Collaboration Process

### Questions Asked

| Round | Questions | Purpose |
|---|---|---|
| Round 1 | Product goal, target users, Splitwise research, success criteria, workflows studied | Establish product scope |
| Round 2 (partial) | Auth method, group roles, single/multi payer, equal split scope, settlement recording, currency | Resolve schema ambiguities |

### Decisions Made

| Decision | Outcome | How decided |
|---|---|---|
| Primary success metric | Accurate balance calculation | User stated in Round 1 |
| Scope | 7 workflows in; 5 categories out | User stated in Round 1 |
| Currency handling | User picks per expense; no conversion | User stated in Round 2 |
| Balance storage | Never stored; computed at query time | AI design decision (schema round) |
| `shareAmount` pre-computation | Always written at expense creation | AI design decision (schema round) |
| Auth method | Email + password, JWT, httpOnly cookie | AI assumption A1 (unconfirmed) |
| Group roles | ADMIN / MEMBER | AI assumption A2 (unconfirmed) |
| Payer model | Single payer only | AI assumption A3 (unconfirmed) |
| Settlement pattern | Manual record; direct balance reduction | AI assumption A6 (unconfirmed) |
| Hard deletes | Yes, no soft-delete | AI assumption A8 (unconfirmed) |

### Evolution of Requirements

| Stage | What changed |
|---|---|
| Initial interview | 7 workflows scoped; 5 features explicitly cut |
| Schema design | Balance computation pattern decided; `shareAmount` pre-compute introduced |
| Round 2 (partial) | A7 overridden: currency is user-selectable, not a global default |
| API design | Logout endpoint added; DELETE for settlement added; ADMIN-only guards defined |
| Frontend (pending) | Screen list defined; component tree drafted |

---

## 4. Tradeoffs

### Simplifications Made

| Simplification | What was simplified | Why |
|---|---|---|
| Single payer | Only one person per expense can be the payer | Multi-payer is rare in casual groups; adds schema complexity |
| No soft-delete | Expenses and groups are hard-deleted | Reduces schema complexity; undo is a v2 feature |
| No comment editing | Comments are insert-only | Acceptable for MVP chat-like comments |
| Computed balances | No cached balance table | Avoids stale data at the cost of slightly heavier reads |
| Static currency list | Currency stored as a plain string | No validation against a standard like ISO 4217 for MVP |
| No pagination | All expenses/comments loaded at once | Groups are small; pagination can be added later |
| No real-time updates | Page refresh to see new data | Polling or WebSockets are a v2 concern |

### Features Skipped

| Feature | Reason skipped |
|---|---|
| Currency conversion | Requires external API; out of scope per user |
| Email notifications | Requires email service integration; out of scope per user |
| Recurring expenses | Complex scheduling logic; out of scope per user |
| Receipt attachments | Requires file storage (S3/Cloudflare); out of scope per user |
| Analytics / reports | Non-core for MVP; user explicitly excluded |
| Social login (OAuth) | Adds external dependency; email+password sufficient for MVP |
| Debt simplification algorithm | Splitwise's "simplify debts" feature that minimizes transactions across N members |
| Friend system outside groups | Splitwise allows tracking debts outside groups; skipped here |

### Future Improvements (v2+)

| Improvement | Description |
|---|---|
| Debt simplification | Minimize number of transactions needed to settle a group using graph reduction |
| Real-time updates | WebSockets or Server-Sent Events for live balance updates |
| Debt simplification | Graph-based algorithm to minimize number of settlements |
| Email notifications | Notify members when expenses are added or settlements recorded |
| Recurring expenses | Scheduled expense creation (e.g., monthly rent) |
| Receipt scanning | OCR or AI-based amount extraction from uploaded images |
| Social login | Google OAuth via NextAuth.js |
| Soft deletes | Preserve deleted expenses for audit trails |
| Pagination | Cursor-based pagination for large expense histories |
| Currency conversion | Live exchange rates via API |
| Mobile app | React Native sharing business logic |
| Export to CSV | Download expense history for accounting |
