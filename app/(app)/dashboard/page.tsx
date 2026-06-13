import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Users, ReceiptText, ShieldAlert, ArrowRight, Wallet, TrendingUp, TrendingDown 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { computeGroupBalances, computeUserNetSummary } from "@/lib/balances";

export const metadata = {
  title: "Dashboard — Spreetail",
  description: "Overview of all your expense groups and balances",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const userId = session.userId as string;

  // Fetch all memberships with FULL expenses and settlements for balance calculation
  const memberships = await prisma.groupMember.findMany({
    where: { userId, leftAt: null },
    include: {
      group: {
        include: {
          members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          expenses: {
            where: { deletedAt: null, transactionType: "EXPENSE" },
            include: { participants: true },
            orderBy: { createdAt: "desc" },
          },
          settlements: {
            where: { deletedAt: null },
          },
          importSessions: {
            include: {
              rows: {
                where: { status: "PENDING" },
              }
            }
          }
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  // Calculate global stats
  const totalGroups = memberships.length;
  
  const uniqueMembers = new Set<string>();
  let totalExpensesCount = 0;
  let totalExpensesAmount = 0;
  let unresolvedAnomalies = 0;
  
  const groupBalancesList = [];

  for (const { group } of memberships) {
    group.members.forEach(m => uniqueMembers.add(m.userId));
    totalExpensesCount += group.expenses.length;
    totalExpensesAmount += group.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    group.importSessions.forEach(session => {
      unresolvedAnomalies += session.rows.length;
    });

    const membersStub = group.members.map(m => ({ id: m.userId, name: m.user.name }));
    const balances = computeGroupBalances(
      group.expenses as any,
      group.settlements as any,
      membersStub
    );
    groupBalancesList.push({ groupId: group.id, groupName: group.name, balances });
  }

  const netSummary = computeUserNetSummary(userId, groupBalancesList);

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1 */}
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
              <Link href="/groups" className="text-xs text-indigo-600 font-medium hover:underline mt-1 block">
                View all groups →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 2 */}
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

        {/* Card 3 */}
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <ReceiptText className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Expenses (All Time)</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">₹{totalExpensesAmount.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1">{totalExpensesCount} expenses</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4 */}
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">You are owed</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">₹{netSummary.totalOwed.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1">Across all groups</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 5 */}
        <Card className="shadow-sm border-gray-100">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">You owe</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">₹{netSummary.totalOwing.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1">Across all groups</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 6 */}
        <Card className="shadow-sm border-red-200 bg-red-50/30">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-medium text-gray-800 text-sm">Unresolved Anomalies</h3>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{unresolvedAnomalies}</p>
              <p className="text-xs text-orange-600 font-medium mt-1">Needs your review</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Your Groups */}
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
                  <th className="px-6 py-4">Your Balance</th>
                  <th className="px-6 py-4">Last Activity</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memberships.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      You are not part of any groups yet.
                    </td>
                  </tr>
                )}
                {memberships.map(({ group }) => {
                  const myNet = groupBalancesList.find(g => g.groupId === group.id)?.balances.members.find(m => m.userId === userId)?.net || 0;
                  const lastExpense = group.expenses[0];
                  
                  return (
                    <tr key={group.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {group.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {group.members.slice(0, 4).map(m => (
                            <Avatar key={m.userId} className="w-8 h-8 border-2 border-white bg-indigo-100">
                              <AvatarImage src={m.user.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs text-indigo-700">{getInitials(m.user.name)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {group.members.length > 4 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 z-10">
                              +{group.members.length - 4}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {group.expenses.length}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {myNet > 0 ? (
                          <span className="text-green-600">+₹{myNet.toLocaleString('en-IN')}</span>
                        ) : myNet < 0 ? (
                          <span className="text-red-600">-₹{Math.abs(myNet).toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-gray-400">Settled up</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {lastExpense ? formatDate(lastExpense.createdAt) : "No activity"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/group/${group.id}/expenses`}>
                          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
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

        {/* Right Column: Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
          <Card className="shadow-sm border-gray-100">
            <CardContent className="p-0">
              <div className="relative p-6 border-l-2 border-gray-100 ml-8 my-4 space-y-8">
                {/* Timeline Item 1 */}
                <div className="relative">
                  <span className="absolute -left-[35px] bg-white p-1 rounded-full border border-gray-200">
                    <ReceiptText className="w-4 h-4 text-gray-500" />
                  </span>
                  <div className="text-sm">
                    <p className="text-gray-900"><span className="font-semibold">You</span> added an expense <span className="font-semibold">"Dinner"</span></p>
                    <p className="text-xs text-gray-400 mt-1">2 hours ago • Flatmates</p>
                  </div>
                </div>

                {/* Timeline Item 2 */}
                <div className="relative">
                  <span className="absolute -left-[35px] bg-white p-1 rounded-full border border-green-200">
                    <Wallet className="w-4 h-4 text-green-500" />
                  </span>
                  <div className="text-sm">
                    <p className="text-gray-900"><span className="font-semibold">Aisha</span> recorded a payment to you</p>
                    <p className="text-xs text-gray-400 mt-1">Yesterday • Goa Trip</p>
                  </div>
                </div>

                {/* Timeline Item 3 */}
                <div className="relative">
                  <span className="absolute -left-[35px] bg-white p-1 rounded-full border border-blue-200">
                    <Users className="w-4 h-4 text-blue-500" />
                  </span>
                  <div className="text-sm">
                    <p className="text-gray-900"><span className="font-semibold">Rohan</span> joined the group</p>
                    <p className="text-xs text-gray-400 mt-1">2 days ago • Flatmates</p>
                  </div>
                </div>

                {/* Timeline Item 4 */}
                <div className="relative">
                  <span className="absolute -left-[35px] bg-white p-1 rounded-full border border-orange-200">
                    <ShieldAlert className="w-4 h-4 text-orange-500" />
                  </span>
                  <div className="text-sm">
                    <p className="text-gray-900"><span className="font-semibold">7 anomalies</span> need review in import</p>
                    <p className="text-xs text-gray-400 mt-1">3 days ago • Flatmates</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
