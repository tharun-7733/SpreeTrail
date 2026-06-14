import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { ReceiptText, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Expenses — Spreetail",
  description: "All your expenses across all groups",
};

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const userId = session.userId as string;

  const expenses = await prisma.expense.findMany({
    where: {
      deletedAt: null,
      group: { members: { some: { userId, leftAt: null } } },
    },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      group: { select: { id: true, name: true } },
      participants: {
        where: { userId },
        select: { shareAmount: true },
      },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <p className="text-sm text-gray-500 mt-0.5">All expenses across your groups</p>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <ReceiptText className="w-7 h-7 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">No expenses yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Start by creating a group and adding your first expense.
            </p>
            <Link
              href="/groups"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Go to Groups →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Group</th>
                <th className="px-6 py-4">Paid By</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Your Share</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {expense.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/group/${expense.group.id}/expenses`}
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      {expense.group.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={expense.paidBy.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px] bg-emerald-50 text-emerald-700">
                          {getInitials(expense.paidBy.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-gray-700">
                        {expense.paidBy.id === userId ? "You" : expense.paidBy.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                    {formatCurrency(Number(expense.amount), expense.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expense.participants.length > 0 ? (
                      <span className={`font-medium ${expense.paidBy.id === userId ? "text-green-600" : "text-red-600"}`}>
                        {expense.paidBy.id === userId ? "+" : "-"}
                        {formatCurrency(Number(expense.participants[0].shareAmount), expense.currency)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      href={`/expense/${expense.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
