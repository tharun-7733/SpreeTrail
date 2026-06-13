"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

interface ExpenseBreakdownItem {
  expenseId: string;
  expenseTitle: string;
  expenseDate: string;
  paidBy: string;
  paidById: string;
  originalAmount: number;
  originalCurrency: string;
  exchangeRate: number;
  convertedAmount: number;
  participantShare: number;
  amountPaid: number;
  netImpact: number;
  source: string;
  transactionType: string;
}

interface Settlement {
  settlementId: string;
  settledAt: string;
  amount: number;
  currency: string;
  direction: "PAID" | "RECEIVED";
  with: string;
  note?: string;
}

interface BreakdownData {
  userId: string;
  groupId: string;
  rawBalance: number;
  settlementsImpact: number;
  totalOwed: number;
  expenseBreakdown: ExpenseBreakdownItem[];
  settlementsApplied: Settlement[];
}

export default function BalanceBreakdownPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const userId = params.userId as string;

  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/balances/${userId}/breakdown`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data);
        else setError(d.message);
      })
      .catch(() => setError("Failed to load breakdown."))
      .finally(() => setLoading(false));
  }, [groupId, userId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
      Loading balance breakdown…
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontFamily: "'Inter', sans-serif" }}>
      {error ?? "Breakdown unavailable."}
    </div>
  );

  const net = data.totalOwed;
  const isOwed = net > 0;
  const isOwing = net < 0;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", fontFamily: "'Inter', sans-serif", color: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1.25rem 2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>← Back</button>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
        <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>Balance Breakdown</h1>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem" }}>

        {/* Net balance card */}
        <div style={{
          background: isOwed ? "rgba(74,222,128,0.08)" : isOwing ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${isOwed ? "rgba(74,222,128,0.3)" : isOwing ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
          borderRadius: "1rem", padding: "2rem", marginBottom: "2rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.875rem" }}>Net Balance</p>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: isOwed ? "#4ade80" : isOwing ? "#f87171" : "#94a3b8", marginTop: "0.25rem" }}>
                {isOwing ? "−" : "+"} ₹{Math.abs(net).toFixed(2)}
              </div>
              <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                {isOwed ? "You are owed this amount" : isOwing ? "You owe this amount" : "You are settled up"}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                <div>Raw balance: {data.rawBalance >= 0 ? "+" : ""}₹{data.rawBalance.toFixed(2)}</div>
                <div>Settlements: {data.settlementsImpact >= 0 ? "+" : ""}₹{data.settlementsImpact.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Expense breakdown */}
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem", color: "#c7d2fe" }}>Expense Breakdown</h2>

        {data.expenseBreakdown.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>No expense activity found.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
            {data.expenseBreakdown.map((item) => (
              <div key={item.expenseId} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>{item.expenseTitle}</div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "1rem" }}>
                      <span>{item.expenseDate}</span>
                      <span>Paid by {item.paidBy}</span>
                      {item.originalCurrency !== "INR" && (
                        <span style={{ color: "#a5b4fc" }}>
                          {item.originalCurrency} @ {item.exchangeRate} → ₹{item.convertedAmount.toFixed(2)}
                        </span>
                      )}
                      {item.source === "IMPORTED" && (
                        <span style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", padding: "0.1rem 0.4rem", borderRadius: "9999px", fontSize: "0.65rem" }}>
                          IMPORTED
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                      Paid: ₹{item.amountPaid.toFixed(2)} / Share: ₹{item.participantShare.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: "1rem", fontWeight: 700, marginTop: "0.15rem",
                      color: item.netImpact > 0 ? "#4ade80" : item.netImpact < 0 ? "#f87171" : "#94a3b8",
                    }}>
                      {item.netImpact > 0 ? "+" : ""}₹{item.netImpact.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settlements */}
        {data.settlementsApplied.length > 0 && (
          <>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem", color: "#c7d2fe" }}>Settlements Applied</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
              {data.settlementsApplied.map((s) => (
                <div key={s.settlementId} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.75rem", padding: "0.875rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>
                      {s.direction === "PAID" ? `You paid ${s.with}` : `${s.with} paid you`}
                    </span>
                    {s.note && <span style={{ color: "#64748b", marginLeft: "0.5rem", fontSize: "0.8rem" }}>• {s.note}</span>}
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>{s.settledAt}</div>
                  </div>
                  <div style={{ color: s.direction === "PAID" ? "#f87171" : "#4ade80", fontWeight: 700 }}>
                    {s.direction === "PAID" ? "−" : "+"}₹{s.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Reconciliation */}
        <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "#a5b4fc", fontWeight: 600 }}>Reconciliation</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Expenses paid − shares owed</span>
              <span>{data.rawBalance >= 0 ? "+" : ""}₹{data.rawBalance.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Settlements applied</span>
              <span>{data.settlementsImpact >= 0 ? "+" : ""}₹{data.settlementsImpact.toFixed(2)}</span>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.35rem", marginTop: "0.1rem", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Net Balance</span>
              <span style={{ color: isOwed ? "#4ade80" : isOwing ? "#f87171" : "#94a3b8" }}>
                {net >= 0 ? "+" : ""}₹{net.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
