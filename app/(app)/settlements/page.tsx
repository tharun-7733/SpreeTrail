import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { Banknote, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Settlements — Spreetail",
  description: "All recorded settlements across your groups",
};

export default async function SettlementsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const userId = session.userId as string;

  const settlements = await prisma.settlement.findMany({
    where: {
      deletedAt: null,
      group: { members: { some: { userId, leftAt: null } } },
    },
    include: {
      payer: { select: { id: true, name: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { settledAt: "desc" },
    take: 100,
  });

  const totalPaid = settlements
    .filter((s) => s.payerId === userId)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const totalReceived = settlements
    .filter((s) => s.receiverId === userId)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>
        <p className="text-sm text-gray-500 mt-0.5">All recorded settlements across your groups</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-green-100 bg-green-50">
          <CardContent className="p-5">
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide">You paid</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-100 bg-indigo-50">
          <CardContent className="p-5">
            <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide">You received</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(totalReceived)}</p>
          </CardContent>
        </Card>
      </div>

      {settlements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
              <Banknote className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">No settlements yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Settlements are recorded when members pay each other back. Go to a group's Balances tab to record one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {settlements.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={s.payer.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs bg-indigo-50 text-indigo-700">
                        {getInitials(s.payer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-gray-900">
                      {s.payer.id === userId ? "You" : s.payer.name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400 px-2">paid</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={s.receiver.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs bg-emerald-50 text-emerald-700">
                        {getInitials(s.receiver.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-gray-900">
                      {s.receiver.id === userId ? "You" : s.receiver.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-base font-bold text-green-600">{formatCurrency(Number(s.amount), s.currency)}</p>
                    <p className="text-xs text-gray-400">{formatDate(s.settledAt)}</p>
                    {s.note && <p className="text-xs text-gray-500 mt-0.5 italic">{s.note}</p>}
                  </div>
                  <Link
                    href={`/group/${s.group.id}/settlements`}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    {s.group.name} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
