# AI_CONTEXT.md — Spreetail (Splitwise MVP)

> **Source of truth for the entire project.**
> Updated after every interview round. Another engineer should be able to recreate this app from this file alone.

---

## 1. Project Overview

| Field | Value |
|---|---|
| Project Name | Spreetail |
| Assignment Type | Internship assignment (3-day MVP) |
| Primary Goal | Showcase software engineering skills to recruiters via a production-like Splitwise clone |
| Priority | Correct functionality + maintainable code > pixel-perfect UI |

---

## 2. Target Users

- Small, informal groups: roommates, friends, travelers
- Real-world scenarios: rent splitting, trip expenses, shared bills
- No enterprise or large-scale team use cases in scope

---

## 3. Product Philosophy

- **Inspiration from Splitwise**, not a pixel-for-pixel clone
- Reasonable product decisions and feature simplifications are acceptable
- Simplicity and clarity preferred over feature completeness for this MVP

---

## 4. Success Criteria

1. **Accurate balance calculation and debt settlement logic** — highest priority
2. Clean and responsive UI — important but secondary
3. Real-time updates — desirable but not required for MVP

---

## 5. Core Workflows (In Scope)

| # | Workflow |
|---|---|
| 1 | User registration and login |
| 2 | Creating groups and managing members |
| 3 | Adding expenses |
| 4 | Splitting expenses: equally, unequally, by percentage, by shares |
| 5 | Viewing group balances and personal summaries |
| 6 | Recording settlements / payments |
| 7 | Expense-specific comments / chat |

---

## 6. Out-of-Scope Features

- Currency conversion
- Email notifications
- Recurring expenses
- Attachments and receipt scanning
- Analytics and advanced reports

---

## 7. Database Schema

**ORM:** Prisma | **Database:** PostgreSQL
**Schema file:** `prisma/schema.prisma`

### Assumptions Made (pending Round 2 confirmation)

| ID | Assumption |
|---|---|
| A1 | Auth: email + password only. JWT-based sessions. No social login. |
| A2 | Group roles: ADMIN (creator) and MEMBER. Only ADMIN can remove members or delete group. |
| A3 | Single payer per expense (one person paid the full bill). |
| A4 | All four split types supported: EQUAL, UNEQUAL, PERCENTAGE, SHARES. |
| A5 | EQUAL split divides only among *selected* participants, not all group members. |
| A6 | Settlements are manually recorded; directly reduce balance. No "settlement expense" pattern. |
| A7 | Users can pick currency per expense. No conversion logic. |
| A8 | Hard deletes only (no soft-delete) for MVP. |
| A9 | Comment editing not supported for MVP — insert only. |

### Tables

| Table | Purpose |
|---|---|
| `users` | Registered users; email + bcrypt-hashed password; no plaintext credentials |
| `groups` | Named expense-sharing groups; balances NOT stored here — computed at query time |
| `group_members` | Junction: User ↔ Group with ADMIN/MEMBER role; unique per (group, user) |
| `expenses` | A bill paid by one user; records total amount, split type, date, currency |
| `expense_participants` | Per-user share of an expense; `shareAmount` always populated for fast balance queries |
| `settlements` | Manual payment recorded between two users; reduces outstanding balance |
| `expense_comments` | Text comments on expenses; insert-only for MVP |

### Key Design Decisions

- **Balances are never stored.** Computed at query time from `expenses → expense_participants` minus `settlements`. Avoids stale data.
- **`shareAmount` is always pre-computed** and stored on `ExpenseParticipant` at write time regardless of split type. Balance queries are a simple SUM — no runtime math.
- **`onDelete: Cascade`** on all child relations for referential integrity.
- **`Decimal(12,2)`** used for all monetary fields to avoid floating-point rounding errors.
- **UUIDs** used as primary keys across all tables.

---

## 8. Frontend Architecture

**Framework:** Next.js 16 (App Router) | **Language:** TypeScript | **Styling:** Tailwind CSS v4 + Radix UI primitives
**Build status:** ✅ Passing — 12 routes, 0 TypeScript errors (verified 2026-06-13)

### Route Map

| Route | Type | Description |
|---|---|---|
| `/` | Static | Redirects → `/dashboard` |
| `/login` | Static | Email + password login form |
| `/register` | Static | Account registration form |
| `/dashboard` | Dynamic SSR | All groups grid + empty state |
| `/group/[id]` | Dynamic CSR | Group detail: expenses, balances, members, settle-up |
| `/expense/[id]` | Dynamic CSR | Expense detail + split breakdown + comments |
| `/balances` | Dynamic SSR | Net balances across all groups |
| `/groups/new` | Dynamic CSR | Create group form |
| `/groups` | Dynamic SSR | All groups grid (identical to dashboard) |

### Component Tree

```
app/
  (auth)/          ← Unauthenticated pages (no sidebar)
  (app)/           ← Auth-guarded pages (sidebar shell)
    layout.tsx     ← Reads session server-side; redirects if unauthenticated

components/
  ui/              ← Button, Input, Card, Dialog, Skeleton, Avatar
  layout/          ← Sidebar (nav + logout + user info)

lib/
  api.ts           ← Type-safe client fetch wrapper (Omit<RequestInit,'body'> pattern)
  auth.ts          ← JWT sign/verify/getSession via jose
  prisma.ts        ← Singleton Prisma client
  utils.ts         ← cn(), formatCurrency(), formatDate(), getInitials()

types/
  index.ts         ← Shared TS interfaces for all domain entities
```

### Key Design Decisions

- **Server Components for data-heavy pages** (`/dashboard`, `/balances`, `/groups`) — no client-side fetch needed, faster TTI.
- **Client Components for interactive pages** (`/group/[id]`, `/expense/[id]`) — dialogs and optimistic updates.
- **Auth guard in `(app)/layout.tsx`** — single server-side check; all child pages are automatically protected.
- **`Omit<RequestInit, 'body'> & { body?: any }`** — fixed TypeScript conflict between `BodyInit` and plain objects.
- **`httpOnly` cookie** — JWT never exposed to JavaScript; secure by default.
- **Violet (#7C3AED) brand colour** throughout all components.

---

## 9. Interview Log

### Round 1 — Product Goals & Research (2026-06-13)
- Q1 answered: Portfolio + recruiter demo; production-like but not feature-complete
- Q2 answered: Small groups (roommates, friends, travelers)
- Q3 answered: Inspiration from Splitwise; own product decisions where needed
- Q4 answered: Balance calculation correctness is the #1 priority
- Q5 answered: 7 core workflows identified; 5 feature categories explicitly out of scope

---

## 8. Open Questions (Pending)

*(To be filled in as interview progresses)*

- [ ] User personas and authentication details
- [ ] MVP scope boundaries (which of the 7 workflows are must-haves vs. nice-to-haves)
- [ ] Data model decisions
- [ ] Splitting logic edge cases
- [ ] Settlement / payment recording mechanics
- [ ] UI screens and routing
- [ ] Frontend architecture
- [ ] Backend architecture
- [ ] Database choice
- [ ] API design
- [ ] Deployment strategy
- [ ] Testing approach
- [ ] Known risks and tradeoffs

---

## 10. Chronological Change Log

> Append-only. New entries go at the bottom of this section.

---

### Update 001 — 2026-06-13 · Schema Design

**What changed:**
- Defined `prisma/schema.prisma` with 7 tables: `users`, `groups`, `group_members`, `expenses`, `expense_participants`, `settlements`, `expense_comments`.
- Introduced `SplitType` enum (`EQUAL | UNEQUAL | PERCENTAGE | SHARES`) and `GroupRole` enum (`ADMIN | MEMBER`).

**Decisions made:**
- Balances never stored in DB — computed at query time from raw rows.
- `shareAmount` pre-computed and stored on `ExpenseParticipant` at write time for all split types. Makes balance queries a simple SUM.
- `Decimal(12,2)` on all monetary fields — avoids floating-point errors.
- UUID primary keys on all tables.
- `onDelete: Cascade` on all child relations.

**Assumptions locked:** A1–A9 (see Section 7).

---

### Update 002 — 2026-06-13 · Currency Decision (User Confirmed)

**What changed:** Assumption A7 overridden by user — currency is **user-selectable per expense**, not a global default.

**Schema impact:** None — `currency String @default("INR")` already supports this.

**UI impact:** Add Expense form must include a currency picker dropdown.

**Limitation introduced:** Cross-currency balance totals on `/balances` are summed numerically without conversion. Known tradeoff — out of scope per user.

---

### Update 003 — 2026-06-13 · Backend Auth APIs

**Files created:**
- `lib/prisma.ts` — Prisma singleton (prevents dev connection exhaustion)
- `lib/auth.ts` — JWT sign/verify/getSession via `jose` (Edge-compatible)
- `app/api/auth/register/route.ts` — POST: Zod validate, bcrypt hash, create user, set httpOnly cookie
- `app/api/auth/login/route.ts` — POST: compare hash, set cookie
- `app/api/auth/me/route.ts` — GET: read cookie, return user profile
- `app/api/auth/logout/route.ts` — POST: delete cookie

**Decisions:**
- JWT in `httpOnly; SameSite=strict` cookie — never exposed to JS.
- 7-day token expiry. bcrypt cost factor 10.
- Generic "Invalid email or password" on failed login (avoids user enumeration).

**Stub folders created** (no `route.ts` yet): `groups/[groupId]/members/`, `.../expenses/[expenseId]/comments/`, `.../balances/`, `.../settlements/`

---

### Update 004 — 2026-06-13 · Frontend Scaffold + Dependencies

**What changed:**
- Next.js 16.2.9 scaffolded via `create-next-app` into `/tmp/spreetail-init` (uppercase dir name rejected by npm — workaround required).
- Config files copied to project root: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`.
- `package.json` updated with full dep set: Radix UI primitives, lucide-react, zod, jose, bcrypt, clsx, tailwind-merge, class-variance-authority, @prisma/client, prisma.
- `npm install` — 504 packages installed.

---

### Update 005 — 2026-06-13 · All Frontend Pages + Components

**Pages built:**

| Route | Render | Description |
|---|---|---|
| `/login` | Static CSR | Email + password form, error + loading states |
| `/register` | Static CSR | Name + email + password form |
| `/dashboard` | SSR | Group cards grid, last expense preview, empty state CTA |
| `/group/[id]` | CSR | Expenses list, balance rows, add-member dialog, settle-up dialog |
| `/expense/[id]` | CSR | Split breakdown, delete (creator only), comment thread |
| `/balances` | SSR | Cross-group net balance computation, owe/owed summary tiles |
| `/groups/new` | CSR | Create group form |

**UI components built:** Button (CVA variants), Input, Card, Dialog (Radix), Skeleton, Avatar (Radix), Sidebar.

**UI decisions:**
- Primary colour: Violet `#7C3AED` (violet-600).
- Auth pages: gradient background, no sidebar.
- All interactive elements carry unique `id` attributes for testability.
- Balance rows: red = you owe, green = you are owed.
- Empty states: illustrated placeholder cards with CTAs.
- Desktop-first layout; sidebar hidden on mobile (mobile nav pending).

**Utility functions:** `cn()`, `formatCurrency()`, `formatDate()`, `getInitials()` in `lib/utils.ts`.

**Shared types:** `types/index.ts` — User, Group, GroupMember, Expense, ExpenseParticipant, Settlement, ExpenseComment, BalanceEntry.

---

### Update 006 — 2026-06-13 · TypeScript Bug Fix

**Bug:** `lib/api.ts` — `FetchOptions` typed as `RequestInit & { body?: any }`. `RequestInit.body` is `BodyInit | null | undefined`, which rejects plain objects. TypeScript error on every API call.

**Fix:** Changed to `Omit<RequestInit, "body"> & { body?: any }`. The `body` is `JSON.stringify`'d inside `apiFetch` before reaching native `fetch`, so `BodyInit` compatibility is satisfied at the call site.

**Build result:** `npm run build` — 12 routes compiled, 0 TypeScript errors. ✅

---

### Update 007 — 2026-06-13 · Balance Calculation Algorithm (Implemented)

**Algorithm (SSR, in `/balances` page):**

```
net(me → other):
  += expense_participants.shareAmount
       WHERE userId = me AND expense.paidById = other
  -= expense_participants.shareAmount
       WHERE expense.paidById = me AND userId = other
  -= settlements.amount WHERE payerId = me AND receiverId = other
  += settlements.amount WHERE payerId = other AND receiverId = me

Filter: |net| < 0.01 → zero balance (floating-point dust)
```

**Known limitation (L3):** Cross-currency sums are aggregated numerically without conversion. Display currency hardcoded to INR on `/balances`. Multi-currency groups show misleading totals.

---

### Update 008 — 2026-06-13 · Known Limitations + Remaining Work

**Known limitations:**

| ID | Description | Severity |
|---|---|---|
| L1 | API routes for Groups, Members, Expenses, Balances, Settlements, Comments — stub folders only, no `route.ts` | Critical |
| L2 | Add Expense page (`/group/[id]/expense/new`) not built | Critical |
| L3 | Cross-currency balance sums are numerically aggregated without conversion | Medium |
| L4 | No pagination on expenses or comments lists | Low |
| L5 | No mobile navigation (sidebar hidden, no hamburger menu) | Low |
| L6 | No `middleware.ts` — auth enforced per-layout only, not at Edge/network layer | Medium |
| L7 | `api.expenses.getById` calls `/api/expenses/[id]` — that route does not exist yet | Critical |
| L8 | `formatCurrency` on `/balances` hardcodes INR for total display | Medium |

**Remaining work to reach full MVP:**
- [ ] API: Groups CRUD
- [ ] API: Members add/remove
- [ ] API: Expenses CRUD with split computation logic
- [ ] API: Balances computation endpoint per group
- [ ] API: Settlements CRUD
- [ ] API: Comments list + create
- [ ] API: `/api/expenses/[id]` top-level route for expense detail page
- [ ] Page: `/group/[id]/expense/new` — Add Expense form (4 split types + currency picker)
- [ ] Mobile navigation component
- [ ] `.env.example` with `DATABASE_URL` and `JWT_SECRET`
- [ ] `prisma migrate dev --name init`
- [ ] Deployment: Vercel + Supabase/Neon

---

### Update 009 — 2026-06-13 · Backend API Implementations + UI Fixes

**What changed:**
- **Server configuration fixes:** Installed missing `express` and `@types/express` packages, and explicitly typed request and response parameters in `server.ts` to solve TypeScript compilation errors (`noImplicitAny`).
- **UI Route Fixes:** Created `app/(app)/groups/page.tsx` since the Sidebar navigation linked to `/groups` but the page did not exist (resulted in a 404). This page now renders a visual list of all expense groups, identical to the dashboard.
- **API routes implemented:**
  - `app/api/groups/route.ts`: Built `GET` (list groups) and `POST` (create group). Replaced the missing endpoint that was blocking group creation.
  - `app/api/groups/[groupId]/route.ts`: Built `GET` to fetch group details and members list.
  - `app/api/groups/[groupId]/expenses/route.ts`: Built `GET` to fetch the chronological list of expenses for a given group.
  - `app/api/groups/[groupId]/balances/route.ts`: Built `GET` to calculate and return exact balances within the group (taking both `ExpenseParticipant` shares and `Settlement` records into account).

**Decisions made:**
- Because the `/group/[id]` dashboard depends on three distinct data sources (metadata, expenses, balances) to render the UI concurrently, three separate `GET` API endpoints were explicitly mapped to supply this granular data rather than a single monolithic payload.

**Known limitations resolved:**
- Partially resolved **L1** (API routes for Groups, Expenses, and Balances reading are now built. Members POST, Settlements POST, and Comments still require implementation).
