"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Wallet, ReceiptText, ArrowRight } from "lucide-react";

export default function BalanceBreakdownPage({ params }: { params: Promise<{ id: string, userId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toUserId = searchParams.get("to");
  
  const [groupId, setGroupId] = useState("");
  const [fromUserId, setFromUserId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id, userId }) => {
      setGroupId(id);
      setFromUserId(userId);
      if (toUserId) {
        loadData(id, userId, toUserId);
      } else {
        setLoading(false);
      }
    });
  }, [params, toUserId]);

  async function loadData(gId: string, fromId: string, toId: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/groups/${gId}/balances/${fromId}/breakdown?toUserId=${toId}`).then(r => r.json());
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="space-y-6 mt-6">
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>;
  }

  if (!toUserId || !data) {
    return <div className="p-8 text-center">Missing required parameters or data not found.</div>;
  }

  const { fromUser, toUser, totalDebt, transactions } = data;

  return (
    <div className="space-y-6 mt-4">
      {/* Header Back Link */}
      <Link href={`/group/${groupId}/balances`} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Balances
      </Link>

      {/* Debt Summary Header Card */}
      <Card className="shadow-sm border-gray-100 bg-gradient-to-br from-red-50 to-orange-50/50">
        <CardContent className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex -space-x-4">
              <Avatar className="w-16 h-16 border-4 border-white shadow-sm z-10">
                <AvatarImage src={fromUser.avatarUrl} />
                <AvatarFallback className="bg-red-100 text-red-700 text-xl font-bold">{getInitials(fromUser.name)}</AvatarFallback>
              </Avatar>
              <Avatar className="w-16 h-16 border-4 border-white shadow-sm opacity-80">
                <AvatarImage src={toUser.avatarUrl} />
                <AvatarFallback className="bg-green-100 text-green-700 text-xl font-bold">{getInitials(toUser.name)}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {fromUser.name} owes {toUser.name}
              </h1>
              <p className="text-3xl font-black text-red-600 mt-1">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Wallet className="w-4 h-4" />
            Record payment
          </Button>
        </CardContent>
      </Card>

      {/* Contributing Expenses Table */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
          <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-gray-500" />
            Contributing Expenses
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Date</th>
                <th className="px-6 py-4 whitespace-nowrap">Description</th>
                <th className="px-6 py-4 whitespace-nowrap">Amount</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">{fromUser.name}'s Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((t: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{formatDate(t.date)}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{t.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {formatCurrency(t.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-red-600">
                      {t.fromUserShare > 0 ? `-${formatCurrency(t.fromUserShare)}` : formatCurrency(t.fromUserShare)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
