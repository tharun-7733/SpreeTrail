import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users, ReceiptText, ShieldAlert, TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, getInitials } from "@/lib/utils";

export const metadata = {
  title: "Dashboard — Spreetail",
  description: "Overview of all your expense groups and balances",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");
  const userId = session.userId as string;
  // ── 4 lean parallel queries — avoids deep nesting that kills Neon pool ──────
  const [memberships, expenseStats, pendingAnomalies, recentExpenses] = await Promise.all([
    // 1. Groups + shallow member list (no expenses, no settlements)
    prisma.groupMember.findMany({
      where: { userId, leftAt: null },
      select: {
        joinedAt: true,
        group: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            members: {
              where: { leftAt: null },
              select: {
                userId: true,
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),

    // 2. Aggregate expense count + sum per group
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

    // 3. Count pending import anomalies across all user's groups
    prisma.importedExpenseRaw.count({
      where: {
        status: "PENDING",
        importSession: { group: { members: { some: { userId, leftAt: null } } } },
      },
    }),

    // 4. Last 5 expenses across all groups for activity feed
    prisma.expense.findMany({
      where: {
        deletedAt: null,
        transactionType: "EXPENSE",
        group: { members: { some: { userId, leftAt: null } } },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        createdAt: true,
        group: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalGroups = memberships.length;
  const uniqueMembers = new Set(
    memberships.flatMap((m) => m.group.members.map((mem) => mem.userId))
  );
  const totalExpensesAmount = expenseStats.reduce(
    (sum, e) => sum + Number(e._sum.amount ?? 0),
    0
  );
  const expenseByGroup = new Map(
    expenseStats.map((e) => [
      e.groupId,
      { count: e._count.id, total: Number(e._sum.amount ?? 0) },
    ])
  );

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Total Groups</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalGroups}</p>
              <Link
                href="/groups"
                className="text-xs text-indigo-600 font-medium hover:underline mt-1 block"
              >
                View all →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Total Members</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{uniqueMembers.size}</p>
              <p className="text-xs text-gray-500 mt-1">Across all groups</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <ReceiptText className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Expenses (All Time)</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                ₹{totalExpensesAmount.toLocaleString("en-IN")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Active Groups</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalGroups}</p>
              <p className="text-xs text-gray-500 mt-1">Active memberships</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`shadow-sm ${
            pendingAnomalies > 0
              ? "border-orange-200 bg-orange-50/30"
              : "border-gray-100"
          }`}
        >
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-800 text-sm">Anomalies</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingAnomalies}</p>
              <p
                className={`text-xs font-medium mt-1 ${
                  pendingAnomalies > 0 ? "text-orange-600" : "text-gray-400"
                }`}
              >
                {pendingAnomalies > 0 ? "Needs review" : "All clear"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Groups Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Your Groups</h2>
            <Link href="/groups/new">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                + New Group
              </Button>
            </Link>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Group Name</th>
                  <th className="px-6 py-4">Members</th>
                  <th className="px-6 py-4">Expenses</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memberships.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      You are not part of any groups yet.
                    </td>
                  </tr>
                )}
                {memberships.map(({ group }) => {
                  const stats = expenseByGroup.get(group.id);
                  return (
                    <tr key={group.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{group.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {group.members.slice(0, 4).map((m) => (
                            <Avatar
                              key={m.userId}
                              className="w-8 h-8 border-2 border-white bg-indigo-100"
                            >
                              <AvatarImage src={m.user.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs text-indigo-700">
                                {getInitials(m.user.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {group.members.length > 4 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                              +{group.members.length - 4}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{stats?.count ?? 0}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/group/${group.id}/expenses`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          >
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-0">
              {recentExpenses.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  No recent activity
                </div>
              ) : (
                <div className="relative p-6 border-l-2 border-gray-100 ml-8 my-4 space-y-8">
                  {recentExpenses.map((expense) => (
                    <div key={expense.id} className="relative">
                      <span className="absolute -left-[35px] bg-white p-1 rounded-full border border-gray-200">
                        <ReceiptText className="w-4 h-4 text-gray-500" />
                      </span>
                      <div className="text-sm">
                        <p className="text-gray-900">
                          <span className="font-semibold">
                            {expense.paidBy.id === userId
                              ? "You"
                              : expense.paidBy.name}
                          </span>{" "}
                          added{" "}
                          <span className="font-semibold">
                            &ldquo;{expense.description}&rdquo;
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(expense.createdAt)} · {expense.group.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
