"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight, ShieldAlert,
  HelpCircle, Copy, AlertTriangle, ArrowLeft
} from "lucide-react";

type Step = "upload" | "map" | "review" | "complete";

// Types
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

export default function ImportWizardPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [report, setReport] = useState<any>(null);
  
  const [dragOver, setDragOver] = useState(false);

  // Stepper UI Data
  const steps = [
    { id: "upload", label: "Upload CSV" },
    { id: "map", label: "Map Columns" },
    { id: "review", label: "Resolve Anomalies" },
    { id: "complete", label: "Complete" }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  // Handlers
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are accepted.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sessionRes = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, filename: file.name }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionData.success) throw new Error(sessionData.message);
      
      const sid = sessionData.data.sessionId;
      setSessionId(sid);

      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch(`/api/imports/${sid}/upload`, {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.message);

      setSessionInfo({ sessionId: sid, ...uploadData.data });
      setStep("map");
      await loadIssues(sid);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadIssues = async (sid: string) => {
    const res = await fetch(`/api/imports/${sid}/issues`);
    const data = await res.json();
    if (data.success) setIssues(data.data.issues ?? []);
  };

  const resolveIssue = async (issueId: string, status: "APPROVED" | "SKIPPED", resolvedAs?: string) => {
    await fetch(`/api/imports/${sessionId}/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        resolvedAs: status === "SKIPPED" ? "SKIPPED" : resolvedAs ?? "EXPENSE",
      }),
    });
    await loadIssues(sessionId!);
  };

  const commitImport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/imports/${sessionId}/complete`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      const reportRes = await fetch(`/api/imports/${sessionId}/report`);
      const reportData = await reportRes.json();
      if (reportData.success) setReport(reportData.data);
      
      setStep("complete");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = issues.filter(i => i.status === "PENDING").length;

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Import Expenses</h1>
        <p className="text-gray-500 mt-1">Upload a CSV to quickly add multiple expenses to your group.</p>
      </div>

      {/* Stepper */}
      <div className="mb-12">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 z-0"></div>
          {steps.map((s, i) => {
            const isCompleted = currentStepIndex > i;
            const isCurrent = currentStepIndex === i;
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2
                  ${isCompleted ? "bg-indigo-600 border-indigo-600 text-white" : 
                    isCurrent ? "bg-white border-indigo-600 text-indigo-600" : 
                    "bg-white border-gray-300 text-gray-400"}`}
                >
                  {isCompleted ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-medium ${isCurrent ? "text-indigo-600" : isCompleted ? "text-gray-900" : "text-gray-400"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="p-8">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFileUpload(f);
              }}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer
                ${dragOver ? "border-indigo-600 bg-indigo-50" : "border-gray-300 hover:border-gray-400 bg-gray-50/50"}`}
              onClick={() => document.getElementById("csv-input")?.click()}
            >
              <div className="w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <UploadCloud className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Upload your CSV</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                Drag and drop your file here, or click to browse. We support Splitwise exports and custom formats.
              </p>
              <Button type="button" className="bg-indigo-600 hover:bg-indigo-700">
                Select File
              </Button>
              <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            </div>

            {loading && (
              <div className="mt-6 text-center text-sm text-indigo-600 font-medium animate-pulse">
                Parsing CSV...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Map Columns ─────────────────────────────────────────────── */}
      {step === "map" && (
        <div className="space-y-6">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
              <CardTitle className="text-base">Map Data Columns</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-6">
                We've automatically detected the following columns. Please review and ensure they match our system fields.
              </p>
              
              <div className="space-y-4">
                {/* Simulated Mapping UI */}
                {[
                  { required: "Date", detected: "Date" },
                  { required: "Description", detected: "Description" },
                  { required: "Amount", detected: "Cost" },
                  { required: "Paid By", detected: "Who paid?" },
                ].map((col, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <span className="text-sm font-medium text-gray-700">{col.required}</span>
                      <span className="text-red-500 ml-1">*</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300" />
                    <div className="w-2/3">
                      <select className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 h-10 px-3 border" defaultValue={col.detected}>
                        <option>{col.detected}</option>
                        <option>Ignore</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <Button onClick={() => setStep("review")} className="bg-indigo-600 hover:bg-indigo-700">
                  Confirm Mapping & Detect Anomalies
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 3: Review Anomalies ─────────────────────────────────────────────── */}
      {step === "review" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Review Anomalies</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">
                {pendingCount} remaining
              </span>
              <Button 
                onClick={commitImport} 
                disabled={pendingCount > 0 || loading}
                className={pendingCount === 0 ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              >
                {pendingCount > 0 ? "Resolve all to continue" : "Complete Import"}
              </Button>
            </div>
          </div>

          {issues.length === 0 ? (
            <Card className="border-green-200 bg-green-50 shadow-sm">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-green-900">Looking good!</h3>
                <p className="text-green-700 mt-1">No anomalies detected. All rows are ready to import.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {issues.map(issue => (
                <Card key={issue.id} className={`shadow-sm overflow-hidden border-l-4 ${issue.status === "PENDING" ? "border-l-orange-500 border-gray-200" : "border-l-gray-300 border-gray-200 opacity-60"}`}>
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Row Data */}
                      <div className="p-5 flex-1 border-b md:border-b-0 md:border-r border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Row {issue.rowNumber}</span>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            issue.status === "APPROVED" ? "bg-green-100 text-green-700" : 
                            issue.status === "SKIPPED" ? "bg-gray-100 text-gray-600" : 
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {issue.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {Object.entries(issue.rawData).filter(([k]) => k !== "rowNumber").slice(0,4).map(([k,v]) => (
                            <div key={k} className="flex flex-col">
                              <span className="text-gray-400 text-xs">{k}</span>
                              <span className="text-gray-900 font-medium truncate">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Anomalies & Actions */}
                      <div className="p-5 md:w-[400px] shrink-0 bg-gray-50/50 flex flex-col justify-between">
                        <div className="space-y-3 mb-4">
                          {issue.anomalies.map((a, i) => (
                            <div key={i} className="flex gap-2 items-start">
                              {a.severity === "ERROR" ? <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5" /> : 
                               <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />}
                              <p className="text-sm text-gray-700 leading-snug">{a.message}</p>
                            </div>
                          ))}
                        </div>
                        
                        {issue.status === "PENDING" && (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
                              onClick={() => resolveIssue(issue.id, "APPROVED", "EXPENSE")}>
                              Approve
                            </Button>
                            {issue.anomalies.some(a => a.anomalyType === "SETTLEMENT_AS_EXPENSE") && (
                              <Button size="sm" variant="outline" className="text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                                onClick={() => resolveIssue(issue.id, "APPROVED", "SETTLEMENT")}>
                                Import as Settlement
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                              onClick={() => resolveIssue(issue.id, "SKIPPED")}>
                              Skip row
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Complete ─────────────────────────────────────────────── */}
      {step === "complete" && report && (
        <Card className="shadow-sm border-gray-200 text-center overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 h-32 flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Successful</h2>
            <p className="text-gray-500 mb-8">Your expenses have been successfully added to the group.</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-3xl font-bold text-gray-900">{report.totalRows}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Total Rows</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-3xl font-bold text-green-700">{report.rowsImported}</p>
                <p className="text-xs text-green-600 mt-1 uppercase font-semibold">Imported</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-3xl font-bold text-indigo-700">{report.rowsConvertedToSettlements}</p>
                <p className="text-xs text-indigo-600 mt-1 uppercase font-semibold">Settlements</p>
              </div>
              <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
                <p className="text-3xl font-bold text-gray-600">{report.rowsSkipped}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Skipped</p>
              </div>
            </div>

            <Button onClick={() => router.push(`/group/${groupId}`)} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
              Return to Group Overview
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
