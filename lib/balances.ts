/**
 * lib/balances.ts — Spreetail Balance Calculation Engine
 *
 * All monetary values are handled as integers (cents) internally to eliminate
 * floating-point rounding errors, then converted back to decimals at output.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FORMULAS OVERVIEW
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. EQUAL SPLIT
 *    baseShare  = floor((total / N) * 100) / 100
 *    dust       = total - (baseShare * N)          ← at most (N-1) cents
 *    first participant absorbs the dust so SUM always equals total exactly.
 *
 * 2. UNEQUAL SPLIT
 *    User supplies explicit shareAmount per participant.
 *    Validation: SUM(shareAmounts) must equal total (within ±0.01).
 *
 * 3. PERCENTAGE SPLIT
 *    baseShare  = floor((total * (pct / 100)) * 100) / 100
 *    dust       = total - SUM(all baseShares)
 *    Dust goes to the participant with the largest percentage (least impact).
 *    Validation: SUM(percentages) must equal 100 (within ±0.01).
 *
 * 4. SHARE SPLIT
 *    totalShares = SUM(all shareUnits)
 *    baseShare   = floor((total * (units / totalShares)) * 100) / 100
 *    dust        = total - SUM(all baseShares)
 *    Dust goes to the participant with the most share units.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BALANCE FORMULAS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Net balance for member M in a group:
 *   net(M) = SUM(expense.amount where paidById = M)          ← what M paid upfront
 *           - SUM(participant.shareAmount where userId = M)   ← what M owes the group
 *           + SUM(settlement.amount where receiverId = M)     ← received repayments
 *           - SUM(settlement.amount where payerId = M)        ← paid repayments out
 *
 *   net > 0  → M is owed money (others owe M)
 *   net < 0  → M owes money (M owes others)
 *   net = 0  → M is settled up
 *
 * Direct debts (A → B):
 *   owed(A→B) = SUM(shareAmount where userId=A, paidById=B)
 *             - SUM(settlement.amount where payerId=A, receiverId=B)
 *
 * Simplified debts — greedy min-transaction algorithm:
 *   1. Compute net balance for each member.
 *   2. Split into Debtors (net < 0) and Creditors (net > 0).
 *   3. Sort both lists by absolute magnitude descending.
 *   4. Match largest debtor ↔ largest creditor; payment = min(|debtor|, creditor).
 *   5. Reduce both balances and repeat until all reach 0.
 */

import type { SplitType } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParticipantInput {
  userId: string;
  /** UNEQUAL: exact amount in dollars  */
  shareAmount?: number;
  /** PERCENTAGE: 0–100 */
  sharePercentage?: number;
  /** SHARES: positive integer weight */
  shareUnits?: number;
}

export interface CalculatedShare {
  userId: string;
  shareAmount: number;        // final dollar amount (2 dp)
  sharePercentage?: number;   // echoed back if provided
  shareUnits?: number;        // echoed back if provided
}

/** Minimal expense row needed for balance computation */
export interface ExpenseRow {
  id: string;
  paidById: string;
  amount: number;             // total expense amount
  participants: {
    userId: string;
    shareAmount: number;
  }[];
}

/** Minimal settlement row needed for balance computation */
export interface SettlementRow {
  payerId: string;
  receiverId: string;
  amount: number;
}

/** Minimal user stub */
export interface UserStub {
  id: string;
  name: string;
}

/** One entry in the "who owes whom" list */
export interface DebtEntry {
  fromUserId: string;
  toUserId: string;
  fromUser: UserStub;
  toUser: UserStub;
  amount: number;             // always positive
}

/** Per-member balance summary */
export interface MemberSummary {
  userId: string;
  user: UserStub;
  totalPaid: number;          // sum of expenses this member paid
  totalOwed: number;          // sum of this member's shares across all expenses
  settlementsOut: number;     // sum of settlements this member made (paid debts)
  settlementsIn: number;      // sum of settlements received
  net: number;                // positive = owed money, negative = owes money
}

/** Full group balance result */
export interface GroupBalances {
  members: MemberSummary[];
  directDebts: DebtEntry[];
  simplifiedDebts: DebtEntry[];
  totalExpenses: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Precision helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Round a dollar value to 2 decimal places (banker-safe floor) */
function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. calculateShares — core splitting engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a total amount and participant inputs, compute the exact dollar share
 * for each participant according to the requested split type.
 *
 * Guarantees: SUM(result.shareAmount) === totalAmount (exact, no rounding drift).
 */
export function calculateShares(
  totalAmount: number,
  splitType: SplitType,
  participants: ParticipantInput[]
): CalculatedShare[] {
  if (participants.length === 0) {
    throw new Error("At least one participant is required.");
  }
  if (totalAmount <= 0) {
    throw new Error("Total amount must be greater than zero.");
  }

  const totalCents = toCents(totalAmount);

  switch (splitType) {
    case "EQUAL":
      return _equalSplit(totalCents, participants);
    case "UNEQUAL":
      return _unequalSplit(totalCents, participants);
    case "PERCENTAGE":
      return _percentageSplit(totalCents, participants);
    case "SHARES":
      return _sharesSplit(totalCents, participants);
    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}

// ── Equal split ──────────────────────────────────────────────────────────────

function _equalSplit(
  totalCents: number,
  participants: ParticipantInput[]
): CalculatedShare[] {
  const n = participants.length;
  const baseCents = Math.floor(totalCents / n);
  const dustCents = totalCents - baseCents * n; // 0 to (n-1) cents

  return participants.map((p, i) => ({
    userId: p.userId,
    // First participant absorbs any dust cents
    shareAmount: fromCents(baseCents + (i === 0 ? dustCents : 0)),
  }));
}

// ── Unequal split ────────────────────────────────────────────────────────────

function _unequalSplit(
  totalCents: number,
  participants: ParticipantInput[]
): CalculatedShare[] {
  const shares = participants.map((p) => {
    if (p.shareAmount === undefined || p.shareAmount < 0) {
      throw new Error(
        `UNEQUAL split: shareAmount is required and must be >= 0 for user ${p.userId}.`
      );
    }
    return { ...p, shareAmount: p.shareAmount };
  });

  const sumCents = toCents(
    shares.reduce((acc, s) => acc + s.shareAmount!, 0)
  );

  // Allow 1-cent tolerance for user input rounding
  if (Math.abs(sumCents - totalCents) > 1) {
    throw new Error(
      `UNEQUAL split: shares sum to ${fromCents(sumCents)} but total is ${fromCents(totalCents)}.`
    );
  }

  return shares.map((p) => ({
    userId: p.userId,
    shareAmount: round2(p.shareAmount!),
  }));
}

// ── Percentage split ─────────────────────────────────────────────────────────

function _percentageSplit(
  totalCents: number,
  participants: ParticipantInput[]
): CalculatedShare[] {
  participants.forEach((p) => {
    if (p.sharePercentage === undefined || p.sharePercentage < 0) {
      throw new Error(
        `PERCENTAGE split: sharePercentage is required and must be >= 0 for user ${p.userId}.`
      );
    }
  });

  const totalPct = participants.reduce((s, p) => s + p.sharePercentage!, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error(
      `PERCENTAGE split: percentages sum to ${totalPct}, must equal 100.`
    );
  }

  // Compute base cents per participant
  const baseCentsArr = participants.map((p) =>
    Math.floor((totalCents * p.sharePercentage!) / 100)
  );
  const sumBase = baseCentsArr.reduce((a, b) => a + b, 0);
  const dustCents = totalCents - sumBase;

  // Give dust to participant with largest percentage
  const maxPctIdx = participants.reduce(
    (best, p, i) =>
      p.sharePercentage! > participants[best].sharePercentage! ? i : best,
    0
  );

  return participants.map((p, i) => ({
    userId: p.userId,
    shareAmount: fromCents(
      baseCentsArr[i] + (i === maxPctIdx ? dustCents : 0)
    ),
    sharePercentage: p.sharePercentage,
  }));
}

// ── Share-weight split ───────────────────────────────────────────────────────

function _sharesSplit(
  totalCents: number,
  participants: ParticipantInput[]
): CalculatedShare[] {
  participants.forEach((p) => {
    if (!p.shareUnits || p.shareUnits <= 0) {
      throw new Error(
        `SHARES split: shareUnits must be a positive integer for user ${p.userId}.`
      );
    }
  });

  const totalUnits = participants.reduce((s, p) => s + p.shareUnits!, 0);

  const baseCentsArr = participants.map((p) =>
    Math.floor((totalCents * p.shareUnits!) / totalUnits)
  );
  const sumBase = baseCentsArr.reduce((a, b) => a + b, 0);
  const dustCents = totalCents - sumBase;

  // Give dust to participant with most share units
  const maxUnitsIdx = participants.reduce(
    (best, p, i) =>
      p.shareUnits! > participants[best].shareUnits! ? i : best,
    0
  );

  return participants.map((p, i) => ({
    userId: p.userId,
    shareAmount: fromCents(
      baseCentsArr[i] + (i === maxUnitsIdx ? dustCents : 0)
    ),
    shareUnits: p.shareUnits,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. computeGroupBalances — full group-level balance engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute all balance data for a group from raw DB rows.
 *
 * @param expenses   All expenses in the group (with participants nested)
 * @param settlements All settlements in the group
 * @param members    All member user stubs in the group
 */
export function computeGroupBalances(
  expenses: ExpenseRow[],
  settlements: SettlementRow[],
  members: UserStub[]
): GroupBalances {
  const userMap = new Map<string, UserStub>(members.map((m) => [m.id, m]));

  // ── Step 1: Per-member summary ────────────────────────────────────────────

  const summaryMap = new Map<string, MemberSummary>();

  const getSummary = (userId: string): MemberSummary => {
    if (!summaryMap.has(userId)) {
      summaryMap.set(userId, {
        userId,
        user: userMap.get(userId) ?? { id: userId, name: "Unknown" },
        totalPaid: 0,
        totalOwed: 0,
        settlementsOut: 0,
        settlementsIn: 0,
        net: 0,
      });
    }
    return summaryMap.get(userId)!;
  };

  // Accumulate expense data
  for (const expense of expenses) {
    getSummary(expense.paidById).totalPaid += expense.amount;
    for (const p of expense.participants) {
      getSummary(p.userId).totalOwed += p.shareAmount;
    }
  }

  // Accumulate settlement data
  for (const s of settlements) {
    getSummary(s.payerId).settlementsOut += s.amount;
    getSummary(s.receiverId).settlementsIn += s.amount;
  }

  // Finalise net for each member
  for (const summary of summaryMap.values()) {
    // net > 0 → owed money; net < 0 → owes money
    summary.net = round2(
      summary.totalPaid
        - summary.totalOwed
        + summary.settlementsIn
        - summary.settlementsOut
    );
    summary.totalPaid = round2(summary.totalPaid);
    summary.totalOwed = round2(summary.totalOwed);
    summary.settlementsOut = round2(summary.settlementsOut);
    summary.settlementsIn = round2(summary.settlementsIn);
  }

  // ── Step 2: Direct debts (A → B per expense, minus settlements) ───────────

  // pairMap[fromId][toId] = net cents owed (positive means fromId owes toId)
  const pairCents = new Map<string, Map<string, number>>();

  const addPair = (fromId: string, toId: string, cents: number) => {
    if (!pairCents.has(fromId)) pairCents.set(fromId, new Map());
    const inner = pairCents.get(fromId)!;
    inner.set(toId, (inner.get(toId) ?? 0) + cents);
  };

  for (const expense of expenses) {
    for (const p of expense.participants) {
      if (p.userId === expense.paidById) continue; // payer doesn't owe themselves
      addPair(p.userId, expense.paidById, toCents(p.shareAmount));
    }
  }

  for (const s of settlements) {
    // A settlement reduces the debt of payerId → receiverId
    addPair(s.payerId, s.receiverId, -toCents(s.amount));
  }

  const directDebts: DebtEntry[] = [];
  for (const [fromId, toMap] of pairCents.entries()) {
    for (const [toId, cents] of toMap.entries()) {
      if (cents > 1) {
        // >1 cent to avoid floating dust
        directDebts.push({
          fromUserId: fromId,
          toUserId: toId,
          fromUser: userMap.get(fromId) ?? { id: fromId, name: "Unknown" },
          toUser: userMap.get(toId) ?? { id: toId, name: "Unknown" },
          amount: fromCents(cents),
        });
      } else if (cents < -1) {
        // Net reversal: toId now owes fromId
        directDebts.push({
          fromUserId: toId,
          toUserId: fromId,
          fromUser: userMap.get(toId) ?? { id: toId, name: "Unknown" },
          toUser: userMap.get(fromId) ?? { id: fromId, name: "Unknown" },
          amount: fromCents(-cents),
        });
      }
    }
  }

  // ── Step 3: Simplified debts (greedy min-transactions) ───────────────────

  const simplifiedDebts = computeSimplifiedDebts(
    [...summaryMap.values()],
    userMap
  );

  // ── Step 4: Total expenses ────────────────────────────────────────────────

  const totalExpenses = round2(
    expenses.reduce((s, e) => s + e.amount, 0)
  );

  return {
    members: [...summaryMap.values()],
    directDebts,
    simplifiedDebts,
    totalExpenses,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. computeSimplifiedDebts — greedy minimum-transaction algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splitwise's "Simplify Debts" feature.
 * Takes the net balance of each member and produces the minimum number of
 * payment transactions needed to settle everyone to zero.
 *
 * Algorithm:
 *   1. net < 0 → debtor  (owes money)
 *   2. net > 0 → creditor (is owed money)
 *   3. Sort both lists by |amount| descending.
 *   4. While debtors and creditors exist:
 *        payment = min(|debtor|, creditor)
 *        emit DebtEntry(debtor → creditor, payment)
 *        reduce both balances by payment; remove if zero.
 */
export function computeSimplifiedDebts(
  members: MemberSummary[],
  userMap: Map<string, UserStub>
): DebtEntry[] {
  // Work in cents to avoid floating point accumulation
  const debtors: { userId: string; cents: number }[] = [];
  const creditors: { userId: string; cents: number }[] = [];

  for (const m of members) {
    const cents = toCents(m.net);
    if (cents < -1) debtors.push({ userId: m.userId, cents: -cents }); // store as positive
    if (cents > 1) creditors.push({ userId: m.userId, cents });
  }

  // Sort largest first
  debtors.sort((a, b) => b.cents - a.cents);
  creditors.sort((a, b) => b.cents - a.cents);

  const results: DebtEntry[] = [];

  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];

    const payment = Math.min(debtor.cents, creditor.cents);
    if (payment > 1) {
      results.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        fromUser: userMap.get(debtor.userId) ?? { id: debtor.userId, name: "Unknown" },
        toUser: userMap.get(creditor.userId) ?? { id: creditor.userId, name: "Unknown" },
        amount: fromCents(payment),
      });
    }

    debtor.cents -= payment;
    creditor.cents -= payment;

    if (debtor.cents <= 1) di++;
    if (creditor.cents <= 1) ci++;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Convenience: net balance map for a single user across groups
// ─────────────────────────────────────────────────────────────────────────────

export interface CrossGroupBalance {
  groupId: string;
  groupName: string;
  net: number; // positive = owed, negative = owes
}

export interface UserNetSummary {
  totalOwed: number;    // sum of positive nets
  totalOwing: number;   // sum of negative nets (as positive number)
  net: number;          // overall net (positive = net creditor)
  byGroup: CrossGroupBalance[];
}

/**
 * Aggregate balance data across multiple groups for a single user.
 * Useful for the /balances dashboard page.
 */
export function computeUserNetSummary(
  userId: string,
  groupBalances: { groupId: string; groupName: string; balances: GroupBalances }[]
): UserNetSummary {
  const byGroup: CrossGroupBalance[] = [];

  for (const { groupId, groupName, balances } of groupBalances) {
    const member = balances.members.find((m) => m.userId === userId);
    if (!member) continue;
    if (Math.abs(member.net) > 0.01) {
      byGroup.push({ groupId, groupName, net: member.net });
    }
  }

  const totalOwed = round2(
    byGroup.filter((g) => g.net > 0).reduce((s, g) => s + g.net, 0)
  );
  const totalOwing = round2(
    byGroup.filter((g) => g.net < 0).reduce((s, g) => s + Math.abs(g.net), 0)
  );

  return {
    totalOwed,
    totalOwing,
    net: round2(totalOwed - totalOwing),
    byGroup,
  };
}
