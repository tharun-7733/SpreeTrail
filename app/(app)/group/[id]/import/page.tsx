"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

type Step = "upload" | "review" | "complete" | "report";

interface Anomaly {
  anomalyType: string;
  severity: "ERROR" | "WARNING" | "INFO";
  field: string;
  rawValue: string;
  message: string;
  requiresApproval: boolean;
}

interface ImportIssue {
  id: string;
  rowNumber: number;
  status: "PENDING" | "APPROVED" | "SKIPPED";
  rawData: Record<string, unknown>;
  anomalies: Anomaly[];
  resolvedAs?: string;
  resolutionNote?: string;
}

interface SessionInfo {
  sessionId: string;
  totalRows: number;
  cleanRows: number;
  rowsWithAnomalies: number;
}

export default function ImportWizardPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [exchangeRate, setExchangeRate] = useState<string>("");
  const [hasUSD, setHasUSD] = useState(false);

  const [dragOver, setDragOver] = useState(false);

  // Step 1: Create session + upload CSV
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are accepted.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create session
      const sessionRes = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, filename: file.name }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionData.success)
        throw new Error(sessionData.message ?? "Failed to create import session.");
      const sid = sessionData.data.sessionId;
      setSessionId(sid);

      // Upload CSV
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch(`/api/imports/${sid}/upload`, {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success)
        throw new Error(uploadData.message ?? "Upload failed.");

      setSessionInfo({ sessionId: sid, ...uploadData.data });

      // Check for USD rows
      const text = await file.text();
      setHasUSD(text.toLowerCase().includes("usd"));

      setStep("review");
      // Load issues
      await loadIssues(sid);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadIssues = async (sid: string) => {
    const res = await fetch(`/api/imports/${sid}/issues`);
    const data = await res.json();
    if (data.success) setIssues(data.data.issues ?? []);
  };

  const resolveIssue = async (
    issueId: string,
    status: "APPROVED" | "SKIPPED",
    resolvedAs?: string,
    note?: string
  ) => {
    const sid = sessionId!;
    await fetch(`/api/imports/${sid}/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        resolvedAs: status === "SKIPPED" ? "SKIPPED" : resolvedAs ?? "EXPENSE",
        resolutionNote: note,
      }),
    });
    await loadIssues(sid);
  };

  const approveAll = async () => {
    const pending = issues.filter((i) => i.status === "PENDING");
    for (const issue of pending) {
      const hasSuggested = issue.anomalies.some(
        (a) => a.anomalyType === "SETTLEMENT_AS_EXPENSE"
      );
      await resolveIssue(
        issue.id,
        "APPROVED",
        hasSuggested ? "SETTLEMENT" : "EXPENSE",
        "Bulk approved"
      );
    }
  };

  const commitImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${sessionId}/complete`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setStep("complete");
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/imports/${sessionId}/report`);
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
        setStep("report");
      }
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = issues.filter((i) => i.status === "PENDING").length;
  const severityColor = (s: string) =>
    s === "ERROR" ? "#ef4444" : s === "WARNING" ? "#f59e0b" : "#6b7280";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", fontFamily: "'Inter', sans-serif", color: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "1.25rem 2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          onClick={() => router.push(`/group/${groupId}`)}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.875rem" }}
        >
          ← Back to Group
        </button>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
        <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>CSV Import Wizard</h1>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "1.5rem 2rem 0" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
          {(["upload", "review", "complete", "report"] as Step[]).map((s, i) => (
            <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
              <div style={{
                width: "2rem", height: "2rem", borderRadius: "50%",
                background: step === s ? "#6366f1" : (["upload", "review", "complete", "report"].indexOf(step) > i ? "#4ade80" : "rgba(255,255,255,0.1)"),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 700,
                transition: "background 0.3s",
              }}>
                {["upload", "review", "complete", "report"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: "0.7rem", color: step === s ? "#a5b4fc" : "#64748b", textTransform: "capitalize" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 2rem 4rem" }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1.5rem", color: "#fca5a5" }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === "upload" && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Upload your CSV file</h2>
            <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
              Anomalies will be detected automatically. You will review each one before any data is written to the database.
            </p>

            {/* USD exchange rate */}
            <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.875rem", marginBottom: "0.5rem", color: "#c7d2fe" }}>
                Exchange Rate (USD → INR) — leave blank if no USD expenses
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ color: "#94a3b8" }}>1 USD =</span>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="83.50"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "#f1f5f9", width: "120px", fontSize: "1rem" }}
                />
                <span style={{ color: "#94a3b8" }}>INR</span>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileUpload(f);
              }}
              style={{
                border: `2px dashed ${dragOver ? "#6366f1" : "rgba(255,255,255,0.15)"}`,
                borderRadius: "1rem",
                padding: "3rem",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.2s",
                background: dragOver ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.02)",
              }}
              onClick={() => document.getElementById("csv-input")?.click()}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📄</div>
              <p style={{ fontSize: "1rem", color: "#cbd5e1", marginBottom: "0.5rem" }}>Drop your CSV here or click to browse</p>
              <p style={{ fontSize: "0.8rem", color: "#64748b" }}>Supports: Splitwise exports, custom CSV</p>
              <input id="csv-input" type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            </div>

            {loading && (
              <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                <div style={{ display: "inline-block", width: "2rem", height: "2rem", border: "3px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <p style={{ marginTop: "1rem" }}>Parsing CSV and detecting anomalies…</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Review ─────────────────────────────────────────────── */}
        {step === "review" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Review Anomalies</h2>
                <p style={{ color: "#94a3b8", margin: 0 }}>
                  {sessionInfo?.totalRows} rows parsed · {pendingCount} issue{pendingCount !== 1 ? "s" : ""} need review
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={approveAll}
                  style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", padding: "0.5rem 1rem", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}
                >
                  Approve All
                </button>
                <button
                  onClick={commitImport}
                  disabled={pendingCount > 0 || loading}
                  style={{
                    background: pendingCount === 0 ? "#6366f1" : "rgba(99,102,241,0.2)",
                    border: "none", color: pendingCount === 0 ? "#fff" : "#94a3b8",
                    padding: "0.5rem 1.25rem", borderRadius: "0.5rem", cursor: pendingCount === 0 ? "pointer" : "not-allowed",
                    fontSize: "0.875rem", fontWeight: 600,
                  }}
                >
                  {loading ? "Committing…" : pendingCount > 0 ? `${pendingCount} pending` : "Commit Import →"}
                </button>
              </div>
            </div>

            {issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#4ade80" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
                <p>No anomalies detected. All rows are clean.</p>
                <button
                  onClick={commitImport}
                  style={{ background: "#6366f1", border: "none", color: "#fff", padding: "0.75rem 2rem", borderRadius: "0.75rem", cursor: "pointer", fontSize: "1rem", fontWeight: 600, marginTop: "1rem" }}
                >
                  Commit All Rows →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${issue.status === "PENDING" ? "rgba(239,68,68,0.3)" : issue.status === "APPROVED" ? "rgba(74,222,128,0.3)" : "rgba(100,116,139,0.3)"}`,
                      borderRadius: "0.75rem",
                      padding: "1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Row {issue.rowNumber}</span>
                      <span style={{
                        fontSize: "0.7rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: issue.status === "APPROVED" ? "rgba(74,222,128,0.15)" : issue.status === "SKIPPED" ? "rgba(100,116,139,0.15)" : "rgba(239,68,68,0.15)",
                        color: issue.status === "APPROVED" ? "#4ade80" : issue.status === "SKIPPED" ? "#94a3b8" : "#f87171",
                      }}>
                        {issue.status}
                      </span>
                    </div>

                    {/* Raw data preview */}
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", background: "rgba(0,0,0,0.2)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", fontFamily: "monospace", overflowX: "auto", whiteSpace: "nowrap" }}>
                      {Object.entries(issue.rawData).filter(([k]) => k !== "rowNumber").map(([k, v]) => (
                        <span key={k} style={{ marginRight: "1rem" }}><span style={{ color: "#6366f1" }}>{k}:</span> {String(v)}</span>
                      ))}
                    </div>

                    {/* Anomalies */}
                    {issue.anomalies.map((a, ai) => (
                      <div key={ai} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: severityColor(a.severity), marginTop: "0.4rem", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>{a.message}</span>
                      </div>
                    ))}

                    {/* Actions */}
                    {issue.status === "PENDING" && (
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                        <button
                          onClick={() => resolveIssue(issue.id, "APPROVED", "EXPENSE", "Manual approval")}
                          style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", borderRadius: "0.4rem", background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", cursor: "pointer" }}
                        >
                          ✓ Approve as Expense
                        </button>
                        {issue.anomalies.some((a) => a.anomalyType === "SETTLEMENT_AS_EXPENSE") && (
                          <button
                            onClick={() => resolveIssue(issue.id, "APPROVED", "SETTLEMENT", "Confirmed as settlement")}
                            style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", borderRadius: "0.4rem", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", cursor: "pointer" }}
                          >
                            ↔ Import as Settlement
                          </button>
                        )}
                        <button
                          onClick={() => resolveIssue(issue.id, "SKIPPED", "SKIPPED", "Manually skipped")}
                          style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", borderRadius: "0.4rem", background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.3)", color: "#94a3b8", cursor: "pointer" }}
                        >
                          Skip Row
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Complete ───────────────────────────────────────────── */}
        {step === "complete" && (
          <div style={{ textAlign: "center", paddingTop: "3rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>Import Complete</h2>
            <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>Your expenses have been imported and are now reflected in the group balance.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
              <button
                onClick={loadReport}
                style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc", padding: "0.75rem 1.5rem", borderRadius: "0.75rem", cursor: "pointer", fontSize: "0.875rem" }}
              >
                View Import Report
              </button>
              <button
                onClick={() => router.push(`/group/${groupId}`)}
                style={{ background: "#6366f1", border: "none", color: "#fff", padding: "0.75rem 1.5rem", borderRadius: "0.75rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}
              >
                Back to Group →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Report ─────────────────────────────────────────────── */}
        {step === "report" && report && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Import Report</h2>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
              {[
                { label: "Total Rows", value: report.totalRows as number },
                { label: "Imported", value: report.rowsImported as number, color: "#4ade80" },
                { label: "As Settlements", value: report.rowsConvertedToSettlements as number, color: "#a5b4fc" },
                { label: "Skipped", value: report.rowsSkipped as number, color: "#94a3b8" },
              ].map((c) => (
                <div key={c.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: c.color ?? "#f1f5f9" }}>{c.value}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Per-row table */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.75rem", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Row", "Description", "Amount", "Status", "Resolved As", "Entity ID"].map((h) => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#64748b", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report.rows as Array<Record<string, unknown>>).map((row) => (
                    <tr key={row.rowNumber as number} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "0.6rem 1rem", color: "#64748b" }}>{row.rowNumber as number}</td>
                      <td style={{ padding: "0.6rem 1rem" }}>{String((row.originalCSVData as Record<string, unknown>)?.description ?? "—")}</td>
                      <td style={{ padding: "0.6rem 1rem" }}>{String((row.originalCSVData as Record<string, unknown>)?.amount ?? "—")}</td>
                      <td style={{ padding: "0.6rem 1rem" }}>
                        <span style={{
                          padding: "0.2rem 0.5rem", borderRadius: "9999px", fontSize: "0.7rem",
                          background: row.status === "APPROVED" ? "rgba(74,222,128,0.15)" : row.status === "SKIPPED" ? "rgba(100,116,139,0.1)" : "rgba(239,68,68,0.15)",
                          color: row.status === "APPROVED" ? "#4ade80" : row.status === "SKIPPED" ? "#94a3b8" : "#f87171",
                        }}>
                          {row.status as string}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 1rem", color: "#a5b4fc" }}>{String(row.resolvedAs ?? "—")}</td>
                      <td style={{ padding: "0.6rem 1rem", fontFamily: "monospace", fontSize: "0.7rem", color: "#64748b" }}>
                        {row.committedEntityId ? String(row.committedEntityId).slice(0, 8) + "…" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
              <button
                onClick={() => router.push(`/group/${groupId}`)}
                style={{ background: "#6366f1", border: "none", color: "#fff", padding: "0.75rem 2rem", borderRadius: "0.75rem", cursor: "pointer", fontSize: "1rem", fontWeight: 600 }}
              >
                Back to Group →
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
