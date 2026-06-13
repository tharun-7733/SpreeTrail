/**
 * lib/membershipUtils.ts
 *
 * Decision 27: Membership window check lives in a single shared utility.
 * Used by BOTH the importer (warn) and the API (block).
 * The enforcement action differs; the rule does not.
 *
 * Rule: joinedAt <= expenseDate AND (leftAt IS NULL OR leftAt >= expenseDate)
 */

export interface MembershipWindow {
  joinedAt: Date;
  leftAt: Date | null;
}

/**
 * Returns true if a member was active at the given expense date.
 * This is the canonical rule used everywhere in the system.
 */
export function isMemberActiveAt(
  membership: MembershipWindow,
  expenseDate: Date
): boolean {
  const joined = membership.joinedAt.getTime();
  const expDate = expenseDate.getTime();

  if (expDate < joined) return false;
  if (membership.leftAt === null) return true;
  return expDate <= membership.leftAt.getTime();
}

/**
 * Formats a membership conflict message for anomaly display.
 */
export function membershipConflictMessage(
  memberName: string,
  expenseDate: Date,
  membership: MembershipWindow
): string {
  const expStr = expenseDate.toISOString().slice(0, 10);
  const joinStr = membership.joinedAt.toISOString().slice(0, 10);

  if (expenseDate < membership.joinedAt) {
    return `${memberName} joined on ${joinStr} but expense is dated ${expStr} (before join date).`;
  }

  const leftStr = membership.leftAt!.toISOString().slice(0, 10);
  return `${memberName} left on ${leftStr} but expense is dated ${expStr} (after leave date).`;
}
