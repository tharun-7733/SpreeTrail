import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, getInitials } from "@/lib/utils";
import { BarChart3, TrendingUp, Users, ReceiptText } from "lucide-react";

export const metadata = {
  title: "Reports — Spreetail",
  description: "Analytics and reports for your expenses",
};

export default async function ReportsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const userId = session.userId as string;

  const [memberships, expenseStats, recentMonthExpenses] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId, leftAt: null },
      select: { group: { select: { id: true, name: true } } },
    }),
    // Aggregated stats per group
    prisma.expense.groupBy({
      by: ["groupId"],
      where: {
        deletedAt: null,
        transactionType: "EXPENSE",
        group: { members: { some: { userId, leftAt: null } } },
      },
      _count: { id: true },
      _sum: { amount: true },
    }),
    // Last 30 days expenses
    prisma.expense.findMany({
      where: {
        deletedAt: null,
        transactionType: "EXPENSE",
        group: { members: { some: { userId, leftAt: null } } },
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        currency: true,
        date: true,
        paidBy: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const statsByGroup = new Map(
    expenseStats.map((e) => [e.groupId, { count: e._count.id, total: Number(e._sum.amount ?? 0) }])
  );

  const totalAllTime = expenseStats.reduce((sum, e) => sum + Number(e._sum.amount ?? 0), 0);
  const totalThisMonth = recentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Spending analytics across all your groups</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">Groups</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{memberships.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ReceiptText className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {expenseStats.reduce((s, e) => s + e._count.id, 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-violet-50 rounded-lg">
                <TrendingUp className="w-4 h-4 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">All-Time Spend</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAllTime)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">Last 30 Days</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalThisMonth)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Spend by group */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 py-4">
            <CardTitle className="text-base font-bold text-gray-900">Spending by Group</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {memberships.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No groups yet</p>
            ) : (
              <div className="space-y-4">
                {memberships.map(({ group }) => {
                  const stats = statsByGroup.get(group.id);
                  const total = stats?.total ?? 0;
                  const maxTotal = Math.max(...Array.from(statsByGroup.values()).map((s) => s.total), 1);
                  const barWidth = (total / maxTotal) * 100;
                  return (
                    <div key={group.id}>
                      <div className="flex items-center justify-between mb-1">
                        <Link
                          href={`/group/${group.id}/expenses`}
                          className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                        >
                          {group.name}
                        </Link>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</span>
                          <span className="text-xs text-gray-400 ml-2">({stats?.count ?? 0} expenses)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 py-4">
            <CardTitle className="text-base font-bold text-gray-900">Recent (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentMonthExpenses.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No expenses in the last 30 days</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentMonthExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {expense.group.name} · {expense.paidBy.id === userId ? "You" : expense.paidBy.name} paid
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(expense.amount), expense.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
