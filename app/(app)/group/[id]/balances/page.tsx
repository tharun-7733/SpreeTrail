"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCurrency, getInitials, cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

export default function GroupBalancesPage({ params }: { params: Promise<{ id: string }> }) {
  const [groupId, setGroupId] = useState("");
  const [balancesData, setBalancesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id }) => {
      setGroupId(id);
      loadBalances(id);
    });
  }, [params]);

  async function loadBalances(id: string) {
    try {
      setLoading(true);
      const res = await api.balances.get(id) as any;
      setBalancesData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !balancesData) {
    return <div className="space-y-6">
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>;
  }

  const { members, simplifiedDebts } = balancesData;

  // Sort members by net (creditors first, then debtors)
  const sortedMembers = [...members].sort((a, b) => b.net - a.net);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
      {/* Left: Net Balance Summary (Who owes whom) */}
      <Card className="shadow-sm border-gray-100 h-fit">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
          <CardTitle className="text-base font-bold text-gray-900">Net Balance Summary (Who owes whom)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {simplifiedDebts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No outstanding debts. Everyone is settled up!
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {simplifiedDebts.map((debt: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-gray-200">
                      <AvatarImage src={debt.fromUser.avatarUrl} />
                      <AvatarFallback className="text-xs bg-red-50 text-red-700">
                        {getInitials(debt.fromUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {debt.fromUser.name} <span className="text-gray-500 font-normal">owes</span> {debt.toUser.name}
                      </p>
                      <p className="text-sm font-bold text-red-600 mt-0.5">
                        {formatCurrency(debt.amount)}
                      </p>
                    </div>
                  </div>
                  <Link href={`/group/${groupId}/balances/${debt.fromUserId}?to=${debt.toUserId}`}>
                    <Button variant="outline" size="sm" className="text-indigo-600 font-medium">
                      View details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Overall Balances */}
      <Card className="shadow-sm border-gray-100 h-fit">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
          <CardTitle className="text-base font-bold text-gray-900">Overall Balances</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {sortedMembers.map((m: any) => {
              const isOwed = m.net > 0;
              const owes = m.net < 0;
              const settled = m.net === 0;
              
              // Max scale logic for simple bar width (assuming max debt is the 100% mark)
              const maxAbsNet = Math.max(...members.map((x: any) => Math.abs(x.net)));
              const barWidth = maxAbsNet === 0 ? 0 : (Math.abs(m.net) / maxAbsNet) * 100;

              return (
                <div key={m.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="w-10 h-10 border border-gray-200">
                      <AvatarImage src={m.user.avatarUrl} />
                      <AvatarFallback className="text-xs bg-gray-100 text-gray-700">
                        {getInitials(m.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.user.name}</p>
                      <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                        {/* If owed, bar goes from left to right in green */}
                        {isOwed && (
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${barWidth}%` }}></div>
                        )}
                        {/* If owes, we could do red */}
                        {owes && (
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${barWidth}%` }}></div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-24">
                    {isOwed && <p className="text-sm font-bold text-green-600">+{formatCurrency(m.net)}</p>}
                    {owes && <p className="text-sm font-bold text-red-600">-{formatCurrency(Math.abs(m.net))}</p>}
                    {settled && <p className="text-sm font-medium text-gray-400">Settled up</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
