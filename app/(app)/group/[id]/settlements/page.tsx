"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Settlement {
  id: string;
  amount: number;
  currency: string;
  note?: string;
  settledAt: string;
  payer: { name: string; avatarUrl?: string };
  receiver: { name: string; avatarUrl?: string };
}

export default function SettlementsPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.settlements.list(groupId)
      .then((data: any) => setSettlements(data))
      .catch((err: any) => setError(err.message || "Failed to load settlements"))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
      Loading settlements…
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
      {error}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900 mb-2 block">
            ← Back to Group
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record of all payments made between members</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {settlements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No settlements recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {settlements.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{s.payer.name}</span>
                    <span className="text-gray-400 text-sm">paid</span>
                    <span className="font-semibold text-gray-900">{s.receiver.name}</span>
                  </div>
                  {s.note && <p className="text-sm text-gray-500 mt-1">{s.note}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(s.settledAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 text-lg">
                    {formatCurrency(s.amount, s.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
