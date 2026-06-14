# Spreetail — Shared Expense Tracker

A production-quality shared expense management application for flatmates, built with **Next.js**, **Prisma**, and **Neon PostgreSQL**.

---

## Live Demo

**[spreetail-ten.vercel.app](https://spreetail-ten.vercel.app)**

---

## Assignment Context

Built as an internship engineering assignment demonstrating:
- CSV import with full anomaly detection and review workflow
- Correct balance calculation with membership date filtering
- Balance traceability (per-expense breakdown)
- Multi-currency support with user-supplied exchange rates
- Soft-delete audit trails

---

## Project Files

| File | Purpose |
|---|---|
| [`DECISIONS.md`](./DECISIONS.md) | 45 documented engineering decisions with rationale and tradeoffs |
| [`SCOPE.md`](./SCOPE.md) | MVP features, schema snapshot, validation rules |
| [`AI_USAGE.md`](./AI_USAGE.md) | AI tool usage log + 3 documented AI mistakes |
| [`BUILD_PLAN.md`](./BUILD_PLAN.md) | Pre-assignment context and initial build plan |
| [`IMPORT_REPORT.md`](./IMPORT_REPORT.md) | Output report of CSV ingestion showing anomaly handling |

---

## AI Usage

This project was built with the assistance of **Google Antigravity (Gemini/Claude)**. 
AI was strictly used as an engineering pair programming partner, not as a black-box code generator. 

Key principles applied during AI collaboration:
- **Interview-first**: The AI was forced to interview me to clarify requirements before writing any code.
- **No silent fixes**: The AI was prevented from silently deleting duplicates or "cleaning" data without user approval.
- **Critical review**: Every AI suggestion was reviewed. Mistakes (such as ignoring membership dates in balance calculations) were caught and corrected.

Detailed prompts, specific AI mistakes, and how they were corrected are fully documented in the [AI_USAGE.md](./AI_USAGE.md) file.

---

## Database Schema (10 tables)

```
User               — authenticated users
Group              — shared expense groups
GroupMember        — membership with joinedAt / leftAt dates
GuestParticipant   — non-authenticated participants (e.g. Kabir)
Expense            — expenses with split types and multi-currency fields
ExpenseParticipant — per-person share amounts per expense
Settlement         — recorded payments between members
ExpenseComment     — comments on individual expenses
ImportSession      — resumable CSV import sessions
ImportedExpenseRaw — raw CSV rows + anomalies + resolutions (permanent audit trail)
```

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Neon PostgreSQL (serverless)
- **ORM:** Prisma 6
- **Auth:** JWT in HTTP-only cookies (`jose`)
- **Validation:** Zod
- **UI:** React 19 + Radix UI + Tailwind CSS

---

## Balance Engine

Located in [`lib/balances.ts`](./lib/balances.ts).

- **Formula:** `net(M) = totalPaid - totalOwed + settlementsIn - settlementsOut`
- **All 4 split types** supported: EQUAL, UNEQUAL, PERCENTAGE, SHARES
- **Membership window filter** (Sam's rule): expenses only counted if `joinedAt ≤ expenseDate ≤ leftAt`
- **Debt simplification** using greedy minimum-transaction algorithm
- **Settlements subtracted dynamically** — expenses are never mutated

---

## CSV Import Pipeline

6-step resumable import process:

1. `POST /api/imports` — create session
2. `POST /api/imports/:sessionId/upload` — upload CSV, detect anomalies
3. `GET /api/imports/:sessionId` — check progress (resumable)
4. `GET /api/imports/:sessionId/issues` — review anomaly list
5. `PATCH /api/imports/:sessionId/issues/:issueId` — resolve each anomaly
6. `POST /api/imports/:sessionId/complete` — commit approved rows
7. `GET /api/imports/:sessionId/report` — computed import report

Raw CSV data is **never overwritten**. Every correction is stored alongside the original value.

---

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL database (e.g., local Postgres or a free Neon.tech account)

### Setup Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/tharun-7733/SpreeTrail.git
   cd Spreetail
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your variables. You must provide a valid PostgreSQL connection string for `DATABASE_URL` and a random string for `JWT_SECRET`.
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/spreetail"
   JWT_SECRET="generate_a_random_secure_string_here"
   ```

4. **Initialize the Database:**
   Push the Prisma schema to your database to create the tables.
   ```bash
   npx prisma db push
   # Optional: generate the Prisma client
   npx prisma generate
   ```

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```

6. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 API Reference

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |

### Groups
| Method | Route | Description |
|---|---|---|
| POST | `/api/groups` | Create group |
| GET | `/api/groups` | List my groups |
| GET | `/api/groups/:groupId` | Group detail (auth) |
| GET | `/api/groups/:groupId/preview` | Public preview (invite links) |
| POST | `/api/groups/:groupId/join` | Join via invite |
| POST | `/api/groups/:groupId/members` | Add member (admin) |
| DELETE | `/api/groups/:groupId/members/:memberId` | Remove member (admin) |

### Expenses
| Method | Route | Description |
|---|---|---|
| GET | `/api/groups/:groupId/expenses` | List expenses |
| POST | `/api/groups/:groupId/expenses` | Create expense |
| GET | `/api/groups/:groupId/expenses/:expenseId` | Expense detail |
| DELETE | `/api/groups/:groupId/expenses/:expenseId` | Soft delete |

### Balances
| Method | Route | Description |
|---|---|---|
| GET | `/api/groups/:groupId/balances` | Summary (simplified + raw net) |
| GET | `/api/groups/:groupId/balances/:userId/breakdown` | Per-expense traceability |

### Settlements
| Method | Route | Description |
|---|---|---|
| GET | `/api/groups/:groupId/settlements` | List settlements |
| POST | `/api/groups/:groupId/settlements` | Record settlement |

### Import
| Method | Route | Description |
|---|---|---|
| POST | `/api/imports` | Create session |
| POST | `/api/imports/:sessionId/upload` | Upload CSV |
| GET | `/api/imports/:sessionId` | Session status |
| GET | `/api/imports/:sessionId/issues` | Anomaly list |
| PATCH | `/api/imports/:sessionId/issues/:issueId` | Resolve anomaly |
| POST | `/api/imports/:sessionId/complete` | Commit rows |
| GET | `/api/imports/:sessionId/report` | Import report |

---

## Data Integrity Rules

- Historical expenses are **immutable after import**
- Manual expenses are editable until settlement activity exists in the group
- All deletes are **soft deletes** (`deletedAt` column) — nothing is permanently destroyed
- Every balance figure is traceable to specific expense rows

---

## Known Limitations (Documented Tradeoffs)

- Exchange rates are user-supplied per import session (not live API rates) — Decision 20
- All USD expenses in one session share one exchange rate — documented approximation
- Balance recomputed on every query — scales well to hundreds of expenses; not optimised for thousands
- No refresh token flow — JWT expiry requires re-login
