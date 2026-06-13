"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Group, GroupMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface NewExpensePageProps {
  params: Promise<{ id: string }>;
}

export default function NewExpensePage({ params }: NewExpensePageProps) {
  const router = useRouter();
  const [groupId, setGroupId] = useState("");
  const [group, setGroup] = useState<(Group & { members: GroupMember[] }) | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [splitType, setSplitType] = useState<"EQUAL" | "UNEQUAL" | "PERCENTAGE" | "SHARES">("EQUAL");
  
  // Participant State
  // We'll store a dictionary mapping userId to their split settings
  const [participantState, setParticipantState] = useState<Record<string, {
    included: boolean;
    manualAmount: string;
    percentage: string;
    shares: string;
  }>>({});

  useEffect(() => {
    params.then(({ id }) => {
      setGroupId(id);
      loadData(id);
    });
  }, [params]);

  async function loadData(id: string) {
    try {
      setLoading(true);
      const [groupData, meData] = await Promise.all([
        api.groups.get(id) as any,
        api.auth.me() as any,
      ]);
      setGroup(groupData.group);
      setCurrentUserId(meData.user.id);
      setPaidById(meData.user.id);

      // Initialize participant state
      const initialPState: any = {};
      groupData.group.members.forEach((m: GroupMember) => {
        initialPState[m.userId] = {
          included: true,
          manualAmount: "",
          percentage: "",
          shares: "1", // default 1 share
        };
      });
      setParticipantState(initialPState);
    } catch (err: any) {
      setError(err.message || "Failed to load group");
    } finally {
      setLoading(false);
    }
  }

  // Calculate the final share amount for a specific user based on the current split type and values
  function calculateShare(userId: string): number {
    const totalAmount = parseFloat(amount) || 0;
    const p = participantState[userId];
    if (!p || !p.included && splitType === "EQUAL") return 0;

    if (splitType === "EQUAL") {
      const includedCount = Object.values(participantState).filter(x => x.included).length;
      if (includedCount === 0) return 0;
      return totalAmount / includedCount;
    } 
    else if (splitType === "UNEQUAL") {
      return parseFloat(p.manualAmount) || 0;
    }
    else if (splitType === "PERCENTAGE") {
      const pct = parseFloat(p.percentage) || 0;
      return totalAmount * (pct / 100);
    }
    else if (splitType === "SHARES") {
      const totalShares = Object.values(participantState).reduce((sum, x) => sum + (parseFloat(x.shares) || 0), 0);
      if (totalShares === 0) return 0;
      return totalAmount * ((parseFloat(p.shares) || 0) / totalShares);
    }
    return 0;
  }

  // Calculate the total of all computed shares to validate
  const totalCalculated = Object.keys(participantState).reduce((sum, userId) => sum + calculateShare(userId), 0);
  const difference = (parseFloat(amount) || 0) - totalCalculated;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const totalAmount = parseFloat(amount);
    if (!totalAmount || totalAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (Math.abs(difference) > 0.05) {
      setError(`The split amounts don't add up to the total. Difference: ${difference.toFixed(2)}`);
      return;
    }

    const participantsPayload = Object.keys(participantState)
      .filter(userId => calculateShare(userId) > 0 || (splitType === "EQUAL" && participantState[userId].included))
      .map(userId => ({
        userId,
        shareAmount: calculateShare(userId),
        sharePercentage: splitType === "PERCENTAGE" ? (parseFloat(participantState[userId].percentage) || 0) : null,
        shareUnits: splitType === "SHARES" ? (parseFloat(participantState[userId].shares) || 0) : null,
      }));

    if (participantsPayload.length === 0) {
      setError("At least one participant must be included.");
      return;
    }

    try {
      setSubmitting(true);
      await api.expenses.create(groupId, {
        description,
        amount: totalAmount,
        paidById,
        splitType,
        participants: participantsPayload,
      });
      router.push(`/group/${groupId}`);
    } catch (err: any) {
      setError(err.message || "Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  }

  function updateParticipant(userId: string, key: string, value: any) {
    setParticipantState(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [key]: value }
    }));
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!group) return <div className="p-8 text-center text-red-500">Group not found</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/group/${groupId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add an expense</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input 
                  placeholder="e.g. Dinner, Uber, Groceries" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (₹)</label>
                <Input 
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
                  <select 
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={paidById}
                    onChange={e => setPaidById(e.target.value)}
                  >
                    {group.members.map(m => (
                      <option key={m.userId} value={m.userId}>
                        {m.userId === currentUserId ? "You" : m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Split Type</label>
                  <select 
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={splitType}
                    onChange={e => setSplitType(e.target.value as any)}
                  >
                    <option value="EQUAL">Equally</option>
                    <option value="UNEQUAL">Unequally (Exact amounts)</option>
                    <option value="PERCENTAGE">By Percentages</option>
                    <option value="SHARES">By Shares</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Split details</h3>
                {amount && (
                  <div className={`text-sm font-medium ${Math.abs(difference) > 0.05 ? "text-red-500" : "text-green-600"}`}>
                    {Math.abs(difference) > 0.05 
                      ? `${difference > 0 ? "₹" + difference.toFixed(2) + " left" : "Over by ₹" + Math.abs(difference).toFixed(2)}`
                      : "Matches exactly ✓"}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {group.members.map(m => {
                  const pState = participantState[m.userId];
                  if (!pState) return null;
                  const calculated = calculateShare(m.userId);

                  return (
                    <div key={m.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      {splitType === "EQUAL" && (
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-600"
                          checked={pState.included}
                          onChange={e => updateParticipant(m.userId, "included", e.target.checked)}
                        />
                      )}
                      
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">{getInitials(m.user.name)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {m.userId === currentUserId ? "You" : m.user.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {splitType === "UNEQUAL" && (
                          <Input 
                            type="number"
                            className="w-24 h-8 text-right"
                            placeholder="0.00"
                            value={pState.manualAmount}
                            onChange={e => updateParticipant(m.userId, "manualAmount", e.target.value)}
                          />
                        )}
                        {splitType === "PERCENTAGE" && (
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number"
                              className="w-20 h-8 text-right"
                              placeholder="0"
                              value={pState.percentage}
                              onChange={e => updateParticipant(m.userId, "percentage", e.target.value)}
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        )}
                        {splitType === "SHARES" && (
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number"
                              className="w-16 h-8 text-right"
                              placeholder="1"
                              value={pState.shares}
                              onChange={e => updateParticipant(m.userId, "shares", e.target.value)}
                            />
                            <span className="text-sm text-gray-500">shares</span>
                          </div>
                        )}
                        
                        {/* Always show the computed amount */}
                        <div className="w-20 text-right text-sm font-semibold text-gray-700">
                          ₹{calculated.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting || (!amount || parseFloat(amount) <= 0)}>
              {submitting ? "Saving..." : "Add expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
