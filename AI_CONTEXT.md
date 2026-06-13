# AI_CONTEXT.md — SpreeTrail (Splitwise MVP)

> **Source of truth for the entire project.**
> Updated after every interview round. Another engineer should be able to recreate this app from this file alone.

---

## 1. Project Overview

| Field | Value |
|---|---|
| Project Name | SpreeTrail |
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
| A7 | Single currency per expense stored as string (default: INR). No conversion. |
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

## 8. Interview Log

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
