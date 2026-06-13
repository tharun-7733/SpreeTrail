import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

export const metadata = {
  title: "Balances — Spreetail",
  description: "Your net balance summary across all groups",
};

export default async function BalancesPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const userId = session.userId as string;

  // Load all groups user belongs to
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { groupId: true, group: { select: { id: true, name: true } } },
  });

  const groupIds = memberships.map(m => m.groupId);

  // Load all expense participants where the user owes someone
  const participantRows = await prisma.expenseParticipant.findMany({
    where: {
      userId,
      expense: { groupId: { in: groupIds } },
    },
    include: {
      expense: {
        include: {
          paidBy: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Load all expenses the user paid
  const paidExpenses = await prisma.expenseParticipant.findMany({
    where: {
      expense: {
        paidById: userId,
        groupId: { in: groupIds },
      },
      NOT: { userId },
    },
    include: {
      user: { select: { id: true, name: true } },
      expense: { include: { group: { select: { id: true, name: true } } } },
    },
  });

  // Load all settlements
  const settlements = await prisma.settlement.findMany({
    where: {
      groupId: { in: groupIds },
      OR: [{ payerId: userId }, { receiverId: userId }],
    },
    include: {
      payer: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  });

  // Compute net balances: positive = I owe them, negative = they owe me
  const balanceMap: Record<string, { user: { id: string; name: string }; net: number }> = {};

  // I owe the payer for each expense I participated in (if paidBy != me)
  for (const row of participantRows) {
    if (row.expense.paidById === userId) continue;
    const otherId = row.expense.paidById;
    const other = row.expense.paidBy;
    if (!balanceMap[otherId]) balanceMap[otherId] = { user: other, net: 0 };
    balanceMap[otherId].net += Number(row.shareAmount);
  }

  // Others owe me for expenses I paid
  for (const row of paidExpenses) {
    const otherId = row.userId;
    const other = row.user;
    if (!balanceMap[otherId]) balanceMap[otherId] = { user: other, net: 0 };
    balanceMap[otherId].net -= Number(row.shareAmount);
  }

  // Settlements reduce balances
  for (const s of settlements) {
    if (s.payerId === userId) {
      // I paid them → I owe less
      const otherId = s.receiverId;
      const other = s.receiver;
      if (!balanceMap[otherId]) balanceMap[otherId] = { user: other, net: 0 };
      balanceMap[otherId].net -= Number(s.amount);
    } else {
      // They paid me → they owe less
      const otherId = s.payerId;
      const other = s.payer;
      if (!balanceMap[otherId]) balanceMap[otherId] = { user: other, net: 0 };
      balanceMap[otherId].net += Number(s.amount);
    }
  }

  const entries = Object.values(balanceMap).filter((e) => Math.abs(e.net) > 0.01);
  const iOwe = entries.filter((e) => e.net > 0);
  const owedToMe = entries.filter((e) => e.net < 0);

  const totalOwed = iOwe.reduce((s, e) => s + e.net, 0);
  const totalReceivable = owedToMe.reduce((s, e) => s + Math.abs(e.net), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Balances</h1>
        <p className="text-sm text-gray-500 mt-0.5">Net balances across all your groups</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-red-100 bg-red-50">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-red-500 font-medium uppercase tracking-wide">You owe</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(totalOwed)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-green-50">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide">You are owed</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalReceivable)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
              <ArrowRight className="w-7 h-7 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">All settled up!</h2>
            <p className="text-sm text-gray-500">You have no outstanding balances across all your groups.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* You owe */}
          {iOwe.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-red-600 uppercase tracking-wide">You owe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {iOwe.map((entry) => (
                  <div key={entry.user.id} className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">{getInitials(entry.user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.user.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-red-600">{formatCurrency(entry.net)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Owed to you */}
          {owedToMe.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-green-600 uppercase tracking-wide">You are owed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {owedToMe.map((entry) => (
                  <div key={entry.user.id} className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">{getInitials(entry.user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.user.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(Math.abs(entry.net))}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
