export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members?: GroupMember[];
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  user: User;
}

export type SplitType = "EQUAL" | "UNEQUAL" | "PERCENTAGE" | "SHARES";

export interface ExpenseParticipant {
  id: string;
  expenseId: string;
  userId: string;
  shareAmount: string;
  sharePercentage?: string | null;
  shareUnits?: number | null;
  user: User;
}

export interface Expense {
  id: string;
  groupId: string;
  paidById: string;
  createdById: string;
  description: string;
  amount: string;
  currency: string;
  splitType: SplitType;
  date: string;
  createdAt: string;
  updatedAt: string;
  paidBy: User;
  createdBy: User;
  participants: ExpenseParticipant[];
}

export interface Settlement {
  id: string;
  groupId: string;
  payerId: string;
  receiverId: string;
  amount: string;
  note?: string | null;
  settledAt: string;
  createdAt: string;
  payer: User;
  receiver: User;
}

export interface ExpenseComment {
  id: string;
  expenseId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: User;
}

export interface BalanceEntry {
  fromUserId: string;
  toUserId: string;
  fromUser: User;
  toUser: User;
  amount: number; // positive = fromUser owes toUser
}
