"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Group, GroupMember, Expense, BalanceEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";
import { Plus, Users, ArrowRight, Trash2, UserPlus, Receipt, ChevronsRight } from "lucide-react";
import Link from "next/link";

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

export default function GroupPage({ params }: GroupPageProps) {
  const router = useRouter();
  const [groupId, setGroupId] = useState<string>("");
  const [group, setGroup] = useState<(Group & { members: GroupMember[] }) | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Settlement dialog
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleBalance, setSettleBalance] = useState<BalanceEntry | null>(null);
  const [settleLoading, setSettleLoading] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setGroupId(id);
      loadAll(id);
    });
  }, []);

  async function loadAll(id: string) {
    try {
      setLoading(true);
      const [groupData, expensesData, balancesData, meData] = await Promise.all([
        api.groups.get(id) as any,
        api.expenses.list(id) as any,
        api.balances.get(id) as any,
        api.auth.me() as any,
      ]);
      setGroup(groupData.group);
      setExpenses(expensesData.expenses);
      setBalances(balancesData.balances);
      setCurrentUserId(meData.user.id);
    } catch (err: any) {
      setError(err.message || "Failed to load group");
    } finally {
      setLoading(false);
    }
  }



  async function handleSettle(balance: BalanceEntry) {
    setSettleBalance(balance);
    setSettleOpen(true);
  }

  async function handleInvite() {
    const inviteLink = `${window.location.origin}/invite/${groupId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${group?.name} on Spreetail`,
          text: `Hey! Join our group "${group?.name}" to track our expenses together.`,
          url: inviteLink,
        });
      } catch (err) {
        // user cancelled or share failed, open fallback dialog
        if ((err as Error).name !== 'AbortError') {
          setAddMemberOpen(true);
        }
      }
    } else {
      // no web share support, open dialog
      setAddMemberOpen(true);
    }
  }

  async function confirmSettle() {
    if (!settleBalance) return;
    setSettleLoading(true);
    try {
      await api.settlements.create(groupId, {
        payerId: settleBalance.fromUserId,
        receiverId: settleBalance.toUserId,
        amount: settleBalance.amount,
      });
      setSettleOpen(false);
      loadAll(groupId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSettleLoading(false);
    }
  }

  if (loading) return <GroupSkeleton />;
  if (error) return <div className="rounded-lg bg-red-50 p-6 text-red-700">{error}</div>;
  if (!group) return null;

  const myBalances = balances.filter(
    (b) => b.fromUserId === currentUserId || b.toUserId === currentUserId
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          {group.description && <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>}
          <p className="text-xs text-gray-400 mt-1">{group.members.length} members</p>
        </div>
        <Link href={`/group/${groupId}/expense/new`}>
          <Button id="add-expense-btn" size="sm">
            <Plus className="w-4 h-4" />
            Add expense
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Expenses + Balances */}
        <div className="lg:col-span-2 space-y-6">
          {/* My balances */}
          {myBalances.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {myBalances.map((b, i) => {
                  const iOwe = b.fromUserId === currentUserId;
                  const otherUser = iOwe ? b.toUser : b.fromUser;
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">{getInitials(otherUser.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{otherUser.name}</p>
                          <p className={cn("text-xs font-semibold", iOwe ? "text-red-500" : "text-green-600")}>
                            {iOwe ? `You owe ${formatCurrency(b.amount)}` : `Owes you ${formatCurrency(b.amount)}`}
                          </p>
                        </div>
                      </div>
                      {iOwe && (
                        <Button
                          id={`settle-btn-${otherUser.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => handleSettle(b)}
                        >
                          Settle up
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Expenses list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-violet-500" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400 italic">No expenses yet. Add the first one!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {expenses.map((expense) => (
                    <Link
                      key={expense.id}
                      href={`/expense/${expense.id}`}
                      id={`expense-row-${expense.id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                        <p className="text-xs text-gray-500">
                          {expense.paidBy.name} paid · {formatDate(expense.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(Number(expense.amount), expense.currency)}
                          </p>
                          <p className="text-xs text-gray-400">{expense.splitType}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Members */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-500" />
                  Members
                </CardTitle>
                <Button
                  id="add-member-btn"
                  size="sm"
                  variant="secondary"
                  className="bg-violet-50 text-violet-700 hover:bg-violet-100 font-medium"
                  onClick={handleInvite}
                >
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-1">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">{getInitials(m.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.user.name}</p>
                    <p className="text-xs text-gray-400">{m.role === "ADMIN" ? "Admin" : "Member"}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Friends</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Share this link with your friends to invite them to {group.name}.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/invite/${groupId}`}
                className="bg-gray-50 text-gray-600 font-mono text-sm"
              />
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/invite/${groupId}`);
                  alert("Link copied to clipboard!");
                  setAddMemberOpen(false);
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settle up dialog */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm settlement</DialogTitle>
          </DialogHeader>
          {settleBalance && (
            <div className="space-y-4">
              <div className="rounded-lg bg-violet-50 p-4 text-center">
                <p className="text-sm text-gray-600">You are recording a payment of</p>
                <p className="text-2xl font-bold text-violet-700 my-1">
                  {formatCurrency(settleBalance.amount)}
                </p>
                <p className="text-sm text-gray-600">
                  to <span className="font-semibold">{settleBalance.toUser.name}</span>
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSettleOpen(false)}>
                  Cancel
                </Button>
                <Button id="confirm-settle-btn" onClick={confirmSettle} disabled={settleLoading}>
                  {settleLoading ? "Recording…" : "Confirm settlement"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
