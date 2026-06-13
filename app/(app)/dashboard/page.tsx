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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {memberships.map(({ group, role }) => {
            const lastExpense = group.expenses[0];
            return (
              <Link key={group.id} href={`/group/${group.id}`} id={`group-card-${group.id}`} className="group relative block">
                {/* Decorative gradient blur behind the card */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500"></div>
                <Card className="glass-card relative border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full overflow-hidden rounded-2xl">
                  {/* Subtle top border accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500"></div>
                  
                  <CardHeader className="pb-3 pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <CardTitle className="text-lg font-bold text-gray-900 truncate tracking-tight">{group.name}</CardTitle>
                        {group.description && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{group.description}</p>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                        <ArrowRight className="w-4 h-4 text-violet-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50/50 w-max px-3 py-1 rounded-full border border-gray-100/50">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{group.members.length} member{group.members.length !== 1 ? "s" : ""}</span>
                    </div>
                    
                    {lastExpense ? (
                      <div className="rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50/50 p-4 border border-violet-100/50">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Latest</p>
                          <p className="text-xs text-gray-400">{formatDate(lastExpense.createdAt)}</p>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate mb-2">{lastExpense.description}</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(Number(lastExpense.amount), lastExpense.currency)}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-gray-50/50 border border-dashed border-gray-200 p-4 text-center">
                        <p className="text-xs text-gray-400 italic">No expenses yet</p>
                      </div>
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
