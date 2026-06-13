import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = {
  title: "Dashboard — Spreetail",
  description: "Overview of all your expense groups and balances",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const userId = session.userId as string;

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
          expenses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { description: true, amount: true, currency: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your expense groups at a glance</p>
        </div>
        <Link href="/groups/new">
          <Button id="create-group-btn" size="sm">
            <Plus className="w-4 h-4" />
            New group
          </Button>
        </Link>
      </div>

      {/* Groups grid */}
      {memberships.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">No groups yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Create a group to start splitting expenses with your friends, roommates, or travel partners.
            </p>
            <Link href="/groups/new">
              <Button id="create-first-group-btn">
                <Plus className="w-4 h-4" />
                Create your first group
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberships.map(({ group, role }) => {
            const lastExpense = group.expenses[0];
            return (
              <Link key={group.id} href={`/group/${group.id}`} id={`group-card-${group.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{group.name}</CardTitle>
                        {group.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{group.description}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-3.5 h-3.5" />
                      <span>{group.members.length} member{group.members.length !== 1 ? "s" : ""}</span>
                    </div>
                    {lastExpense ? (
                      <div className="rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-xs text-gray-500">Latest expense</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{lastExpense.description}</p>
                        <p className="text-sm text-violet-600 font-semibold">
                          {formatCurrency(Number(lastExpense.amount), lastExpense.currency)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No expenses yet</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
