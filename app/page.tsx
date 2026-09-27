"use client";

import { useRef, useState } from "react";
import type { WebsiteAnalysis } from "@/agent/types";
import { StatusLog, type LogEntry } from "@/components/StatusLog";
import { AnalysisSummary } from "@/components/AnalysisSummary";
import { PreviewFrame } from "@/components/PreviewFrame";

type Phase = "idle" | "analyzing" | "analyzed" | "generating" | "ready" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pushLog(message: string) {
    setLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), message }]);
  }

  function pollStatus(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    let lastMessage = "";
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.statusMessage && data.statusMessage !== lastMessage) {
          lastMessage = data.statusMessage;
          pushLog(data.statusMessage);
        }
      } catch {
        // Polling is best-effort UI feedback - a missed tick isn't fatal.
      }
    }, 800);
  }

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  async function handleAnalyze() {
    setError(null);
    setAnalysis(null);
    setPreviewUrl(null);
    setPhase("analyzing");
    pushLog(`Analyzing ${url}...`);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");

      setJobId(data.jobId);
      setAnalysis(data.analysis);
      setPhase("analyzed");
      pushLog("Analysis complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setPhase("error");
    }
  }

  async function handleGenerate() {
    if (!jobId) return;
    setError(null);
    setPhase("generating");
    pollStatus(jobId);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      stopPolling();
      if (!res.ok) throw new Error(data.error || "Generation failed.");

      setPreviewUrl(data.previewUrl);
      setFiles(data.files || []);
      setPhase("ready");
      pushLog("Ready for preview.");
    } catch (err) {
      stopPolling();
      setError(err instanceof Error ? err.message : "Generation failed.");
      setPhase("error");
    }
  }

  async function handleModify() {
    if (!jobId || !instruction.trim()) return;
    setError(null);
    pollStatus(jobId);
    pushLog(`Applying: "${instruction}"`);

    try {
      const res = await fetch("/api/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, instruction }),
      });
      const data = await res.json();
      stopPolling();
      if (!res.ok) throw new Error(data.error || "Modification failed.");

      pushLog(data.explanation || "Modification applied.");
      setInstruction("");
    } catch (err) {
      stopPolling();
      setError(err instanceof Error ? err.message : "Modification failed.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 border-b border-neutral-200 pb-4">
        <h1 className="text-lg font-semibold text-neutral-900">Website Cloning Agent</h1>
        <p className="text-sm text-neutral-500">
          Analyze a public website and generate a new React/Next.js frontend for it.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Main area: input, preview */}
        <section className="space-y-6">
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={handleAnalyze}
              disabled={!url || phase === "analyzing" || phase === "generating"}
              className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Analyze
            </button>
          </div>

          {analysis && (
            <button
              onClick={handleGenerate}
              disabled={phase === "generating"}
              className="rounded border border-neutral-900 px-4 py-2 text-sm disabled:opacity-40"
            >
              {phase === "generating" ? "Generating..." : "Generate frontend"}
            </button>
          )}

          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <PreviewFrame previewUrl={previewUrl} />
        </section>

        {/* Sidebar: analysis, files, modification */}
        <aside className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-medium text-neutral-900">Analysis</h2>
            {analysis ? (
              <AnalysisSummary analysis={analysis} />
            ) : (
              <p className="text-sm text-neutral-500">No analysis yet.</p>
            )}
          </div>

          {files.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-neutral-900">Generated files</h2>
              <ul className="space-y-0.5 font-mono text-xs text-neutral-700">
                {files.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {phase === "ready" && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-neutral-900">Modify</h2>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='e.g. "Change the primary color to blue"'
                rows={3}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={handleModify}
                disabled={!instruction.trim()}
                className="mt-2 rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                Modify
              </button>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-medium text-neutral-900">Activity</h2>
            <StatusLog entries={log} />
          </div>
        </aside>
      </div>
    </main>
  );
}
