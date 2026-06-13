"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Expense, ExpenseComment } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { ArrowLeft, MessageCircle, Receipt, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ExpensePage() {
  const params = useParams();
  const router = useRouter();
  const expenseId = params.id as string;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [comments, setComments] = useState<ExpenseComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    loadAll();
  }, [expenseId]);

  async function loadAll() {
    try {
      setLoading(true);
      // We need groupId for the API — fetch expense first via search or store it
      // For MVP, expense detail is at /expense/[id] and we call a top-level expense endpoint
      const [expenseData, meData] = await Promise.all([
        api.expenses.getById(expenseId) as any,
        api.auth.me() as any,
      ]);
      setExpense(expenseData.expense);
      setComments(expenseData.comments || []);
      setCurrentUserId(meData.user.id);
    } catch (err: any) {
      setError(err.message || "Failed to load expense");
    } finally {
      setLoading(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !expense) return;
    setCommentLoading(true);
    try {
      await api.comments.create(expense.groupId, expense.id, { content: comment });
      setComment("");
      loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCommentLoading(false);
    }
  }

  async function handleDelete() {
    if (!expense || !confirm("Delete this expense?")) return;
    try {
      await api.expenses.delete(expense.groupId, expense.id);
      router.push(`/group/${expense.groupId}`);
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <ExpenseSkeleton />;
  if (error) return <div className="rounded-lg bg-red-50 p-6 text-red-700">{error}</div>;
  if (!expense) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Link
        href={`/group/${expense.groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        id="expense-back-link"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to group
      </Link>

      {/* Expense detail card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{expense.description}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {expense.paidBy.name} paid · {formatDate(expense.date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-violet-700">
                {formatCurrency(Number(expense.amount), expense.currency)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{expense.splitType} split</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Participants */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Split among</p>
            <div className="space-y-2">
              {expense.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="text-xs">{getInitials(p.user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-900">
                      {p.user.name}
                      {p.userId === expense.paidById && (
                        <span className="ml-1 text-xs text-violet-500 font-medium">(paid)</span>
                      )}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(p.shareAmount), expense.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delete (creator or admin) */}
          {expense.createdById === currentUserId && (
            <div className="pt-2">
              <Button
                id="delete-expense-btn"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-violet-500" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 && (
            <p className="text-sm text-gray-400 italic">No comments yet. Start the conversation!</p>
          )}
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarFallback className="text-xs">{getInitials(c.user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-gray-900">{c.user.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(c.createdAt)}</p>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{c.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Add comment */}
          <form onSubmit={handleComment} className="flex gap-2 pt-2" id="comment-form">
            <Input
              id="comment-input"
              placeholder="Add a comment…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="flex-1"
            />
            <Button id="comment-submit" type="submit" size="sm" disabled={commentLoading || !comment.trim()}>
              {commentLoading ? "…" : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpenseSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
