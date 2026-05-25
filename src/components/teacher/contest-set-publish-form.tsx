"use client";

import * as React from "react";
import { ProblemStatus, Subject } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Stage = "LOCAL" | "COUNTY" | "NATIONAL" | "SELECTION" | "FINAL_ROUND" | "INTERNATIONAL" | "OTHER";

type ProblemRow = { orderNumber: number; title: string; shortSummary: string; maxScore: number };
type AttachmentRole = "STATEMENT" | "RUBRIC" | "LEADERBOARD" | "SUPPORTING" | "PROBLEM_STATEMENT" | "PROBLEM_RUBRIC";

type RubricItem = { milestone_name: string; allocated_points: number; grading_criteria: string };
type MasterRubric = { problem_summary: string; rubric_breakdown: RubricItem[] };
type AttachmentRow = {
  id: string;
  role: AttachmentRole;
  fileUrl: string;
  originalName: string;
  fileType?: string;
  mimeType?: string;
  problemOrderNumber?: number | null;
  problemAssetType?: string | null;
};

export type ContestSetInitial = {
  id: string | null;
  title: string;
  subject: Subject;
  competitionName: string;
  year: number;
  class: number;
  stage: Stage;
  source: string;
  summary: string;
  statementMode: string;
  statementDisplayMode: string;
  statementText: string;
  statementPdfUrl: string;
  rubricPdfUrl: string;
  rubricText: string;
  leaderboardPdfUrl: string;
  status: ProblemStatus;
  problems: ProblemRow[];
  problemRubrics?: Record<number, unknown>;
  attachments: AttachmentRow[];
};

function stageLabel(stage: Stage, subject?: Subject): string {
  if (stage === "LOCAL") return subject === Subject.PHYSICS ? "Evrika" : "Locală";
  if (stage === "COUNTY") return "Județeană";
  if (stage === "NATIONAL") return "Națională";
  return stage;
}

function autoTitle(subject: Subject, stage: Stage, year: number): string {
  const sub = subject === Subject.MATH ? "Matematică" : subject === Subject.PHYSICS ? "Fizică" : "Chimie";
  const label = stageLabel(stage, subject);
  return subject === Subject.PHYSICS && stage === "LOCAL"
    ? `Evrika ${year}`
    : `Olimpiada de ${sub} - Etapa ${label} ${year}`;
}

function makeProblems(count: number, existing: ProblemRow[]): ProblemRow[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const found = existing.find((p) => p.orderNumber === n);
    return found ?? { orderNumber: n, title: `Problema ${n}`, shortSummary: "", maxScore: 100 };
  });
}

export function ContestSetPublishForm({ initial }: { initial: ContestSetInitial }) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial);
  const [problemCount, setProblemCount] = React.useState(initial.problems.length || 3);
  const [titleEdited, setTitleEdited] = React.useState(!!initial.id);
  const [pending, setPending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<string[]>([]);
  const isPublished = initial.status === ProblemStatus.PUBLISHED;

  const [rubrics, setRubrics] = React.useState<Record<number, MasterRubric | null>>(() => {
    const init: Record<number, MasterRubric | null> = {};
    for (const p of initial.problems) {
      const r = initial.problemRubrics?.[p.orderNumber];
      init[p.orderNumber] = r ? (r as MasterRubric) : null;
    }
    return init;
  });
  const [generating, setGenerating] = React.useState(false);
  const [generatedCount, setGeneratedCount] = React.useState<number | null>(null);

  // Keep problems array in sync with problemCount
  React.useEffect(() => {
    setForm((prev) => ({
      ...prev,
      problems: makeProblems(problemCount, prev.problems),
    }));
  }, [problemCount]);

  React.useEffect(() => {
    if (!titleEdited) {
      setForm((prev) => ({ ...prev, title: autoTitle(prev.subject, prev.stage, prev.year) }));
    }
  }, [form.subject, form.stage, form.year, titleEdited]);

  function patch<K extends keyof ContestSetInitial>(key: K, value: ContestSetInitial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload(targetStatus: string) {
    return {
      title: form.title || autoTitle(form.subject, form.stage, form.year),
      subject: form.subject,
      competitionName: form.title || autoTitle(form.subject, form.stage, form.year),
      year: form.year,
      class: form.class,
      stage: form.stage,
      statementMode: "PDF_ONLY",
      statementDisplayMode: "PDF_FIRST",
      statementText: form.statementText?.trim() || null,
      statementPdfUrl: form.statementPdfUrl || null,
      rubricPdfUrl: form.rubricPdfUrl || null,
      rubricText: form.rubricText?.trim() || null,
      leaderboardPdfUrl: form.leaderboardPdfUrl || null,
      status: isPublished ? ProblemStatus.PUBLISHED : targetStatus,
      problems: form.problems.map((p, i) => ({
        orderNumber: p.orderNumber || i + 1,
        title: p.title || `Problema ${i + 1}`,
        maxScore: 100,
      })),
      attachments: form.attachments.map((a) => ({
        role: a.role,
        fileType: a.fileType ?? (a.mimeType?.startsWith("image/") ? "IMAGE" : "PDF"),
        problemOrderNumber: a.problemOrderNumber ?? null,
      })),
    };
  }

  async function ensureDraft(): Promise<string | null> {
    if (form.id) return form.id;
    const payload = buildPayload("DRAFT");
    const res = await fetch("/api/teacher/contest-sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Nu s-a putut crea draft-ul.");
      return null;
    }
    const id: string = data?.contestSet?.id;
    if (!id) return null;
    setForm((prev) => ({ ...prev, id }));
    window.history.replaceState(null, "", `/teacher/contest-sets/${id}/edit`);
    return id;
  }

  async function saveSilent(): Promise<string | null> {
    const id = await ensureDraft();
    if (!id) return null;
    const payload = buildPayload("DRAFT");
    const res = await fetch(`/api/teacher/contest-sets/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Nu s-a putut salva textele.");
      return null;
    }
    return id;
  }

  async function generateAllRubrics() {
    if (!form.rubricText?.trim()) {
      setError("Adaugă mai întâi textul baremului (copy-paste din PDF).");
      return;
    }
    setError(null);
    setInfo(null);
    const id = await saveSilent();
    if (!id) return;

    setGenerating(true);
    setGeneratedCount(null);
    try {
      const res = await fetch(`/api/teacher/contest-sets/${id}/generate-rubric`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ totalProblems: problemCount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Generarea rubricilor a eșuat.");
        return;
      }
      const generated = data.rubrics as MasterRubric[];
      const newRubrics: Record<number, MasterRubric | null> = {};
      generated.forEach((r, i) => { newRubrics[i + 1] = r; });
      setRubrics(newRubrics);
      setGeneratedCount(generated.length);
      if (generated.length !== problemCount) {
        setError(`AI-ul a generat ${generated.length} rubrici, dar ai specificat ${problemCount} probleme. Verifică textul sau regenerează.`);
      } else {
        setInfo(`${generated.length} rubrici generate cu succes.`);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function clearAllRubrics() {
    if (!form.id) return;
    await fetch(`/api/teacher/contest-sets/${form.id}/generate-rubric`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    setRubrics({});
    setGeneratedCount(null);
  }

  async function upload(role: AttachmentRole, file: File) {
    setUploading(true);
    setError(null);
    try {
      const id = await ensureDraft();
      if (!id) return;
      const fd = new FormData();
      fd.set("role", role);
      fd.set("file", file);
      const res = await fetch(`/api/teacher/contest-sets/${id}/attachments`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? `Eroare ${res.status} la încărcare.`); return; }
      const att = data?.attachment as AttachmentRow | undefined;
      if (!att) { setError("Răspuns invalid de la server."); return; }
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, att] }));
      if (role === "STATEMENT") patch("statementPdfUrl", att.fileUrl);
      if (role === "RUBRIC") patch("rubricPdfUrl", att.fileUrl);
      if (role === "LEADERBOARD") patch("leaderboardPdfUrl", att.fileUrl);

      if (role === "STATEMENT" || role === "RUBRIC") {
        setInfo(`Încărcat: ${att.originalName} — extrag textul...`);
        try {
          const extractRes = await fetch("/api/teacher/extract-pdf-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: att.fileUrl }),
          });
          const extractData = await extractRes.json().catch(() => ({}));
          if (extractRes.ok && extractData?.text) {
            if (role === "STATEMENT") patch("statementText", extractData.text);
            if (role === "RUBRIC") patch("rubricText", extractData.text);
            setInfo(`Încărcat: ${att.originalName} — text extras automat.`);
          } else {
            setInfo(`Încărcat: ${att.originalName} — extragere text eșuată, adaugă manual.`);
          }
        } catch {
          setInfo(`Încărcat: ${att.originalName} — extragere text eșuată, adaugă manual.`);
        }
      } else {
        setInfo(`Încărcat: ${att.originalName}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută la încărcare.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!form.id) return;
    const att = form.attachments.find((a) => a.id === attachmentId);
    const res = await fetch(`/api/teacher/contest-sets/${form.id}/attachments`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    if (!res.ok) return;
    setForm((prev) => {
      const next = { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) };
      if (att?.role === "STATEMENT") next.statementPdfUrl = "";
      if (att?.role === "RUBRIC") next.rubricPdfUrl = "";
      if (att?.role === "LEADERBOARD") next.leaderboardPdfUrl = "";
      return next;
    });
  }

  async function save(targetStatus: ProblemStatus) {
    setPending(true);
    setError(null);
    setInfo(null);
    setFieldErrors([]);
    const id = await ensureDraft();
    if (!id) { setPending(false); return; }
    const payload = buildPayload(targetStatus);
    const res = await fetch(`/api/teacher/contest-sets/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data?.error ?? "Nu s-a putut salva.");
      if (Array.isArray(data?.errors)) setFieldErrors(data.errors as string[]);
      if (data?.issues && typeof data.issues === "object") {
        const parsed = Object.entries(data.issues as Record<string, unknown>).flatMap(([k, v]) =>
          Array.isArray(v) ? (v as string[]).map((msg) => `${k}: ${msg}`) : [],
        );
        if (parsed.length > 0) setFieldErrors(parsed);
      }
      return;
    }
    setInfo(targetStatus === ProblemStatus.PUBLISHED ? "Concurs publicat." : "Draft salvat.");
    router.refresh();
  }

  const hasAnyRubric = form.problems.some((p) => rubrics[p.orderNumber]);
  const allRubricsMatch = form.problems.every((p) => rubrics[p.orderNumber]);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 pb-10">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold text-zinc-900">{form.id ? "Editează concurs" : "Concurs nou"}</h2>
        <p className="text-sm text-zinc-500">
          PDF-urile sunt vizibile elevilor. Textele sunt folosite de AI la corectare.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>}
      {info && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{info}{uploading ? " (upload în curs…)" : ""}</div>}
      {fieldErrors.length > 0 && (
        <ul className="list-disc rounded-xl border border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-900">
          {fieldErrors.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}

      {/* Basic info */}
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Informații concurs</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">An</label>
            <Input type="number" value={form.year} onChange={(e) => patch("year", Number(e.target.value))} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Clasa</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={form.class}
              onChange={(e) => patch("class", Number(e.target.value))}
            >
              <option value={0}>— nicio clasă —</option>
              {Array.from({ length: 8 }).map((_, i) => {
                const v = i + 5;
                return <option key={v} value={v}>Clasa {v}</option>;
              })}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Materie</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={form.subject}
              onChange={(e) => patch("subject", e.target.value as Subject)}
            >
              <option value="MATH">Matematică</option>
              <option value="PHYSICS">Fizică</option>
              <option value="CHEMISTRY">Chimie</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Etapă</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={form.stage}
              onChange={(e) => patch("stage", e.target.value as Stage)}
            >
              <option value="LOCAL">{form.subject === "PHYSICS" ? "Evrika" : "Locală"}</option>
              <option value="COUNTY">Județeană</option>
              <option value="NATIONAL">Națională</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Titlu (auto-generat, editabil)</label>
            <Input
              value={form.title}
              onChange={(e) => { setTitleEdited(true); patch("title", e.target.value); }}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Nr. probleme</label>
            <Input
              type="number"
              min={1}
              max={20}
              className="w-28"
              value={problemCount}
              onChange={(e) => {
                const v = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                setProblemCount(v);
              }}
            />
          </div>
        </div>
      </div>

      {/* Public PDF */}
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-sky-50 p-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">PDF subiect (pentru elevi)</h3>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900">Public</span>
          </div>
          <p className="text-xs text-zinc-600">Elevii deschid acest PDF ca să citească subiectele.</p>
        </div>
        {form.statementPdfUrl ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs">
            <a href={form.statementPdfUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-[color:var(--accent)] underline">
              PDF încărcat
            </a>
            <button
              type="button"
              className="shrink-0 text-red-600 hover:underline"
              onClick={() => {
                const pdfAtt = form.attachments.find((a) => a.role === "STATEMENT");
                if (pdfAtt) void removeAttachment(pdfAtt.id);
                patch("statementPdfUrl", "");
              }}
            >
              Șterge
            </button>
          </div>
        ) : (
          <label className="grid gap-1 text-xs text-zinc-600">
            <span>Încarcă PDF subiect</span>
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload("STATEMENT", f); e.target.value = ""; }}
            />
          </label>
        )}
      </div>

      {/* PDF barem */}
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-amber-50 p-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">PDF barem</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Ascuns inițial</span>
          </div>
          <p className="text-xs text-zinc-600">Elevii trebuie să apese un buton pentru a vedea baremul — nu e vizibil din start.</p>
        </div>
        {form.rubricPdfUrl ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs">
            <a href={form.rubricPdfUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-[color:var(--accent)] underline">
              PDF barem încărcat
            </a>
            <button
              type="button"
              className="shrink-0 text-red-600 hover:underline"
              onClick={() => {
                const pdfAtt = form.attachments.find((a) => a.role === "RUBRIC");
                if (pdfAtt) void removeAttachment(pdfAtt.id);
                else patch("rubricPdfUrl", "");
              }}
            >
              Șterge
            </button>
          </div>
        ) : (
          <label className="grid gap-1 text-xs text-zinc-600">
            <span>Încarcă PDF barem</span>
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload("RUBRIC", f); e.target.value = ""; }}
            />
          </label>
        )}
      </div>

      {/* PDF clasament */}
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-emerald-50 p-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">PDF clasament</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">Opțional</span>
          </div>
          <p className="text-xs text-zinc-600">Apare elevilor doar dacă îl încarci. Lasă gol dacă nu ai clasament.</p>
        </div>
        {form.leaderboardPdfUrl ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs">
            <a href={form.leaderboardPdfUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-[color:var(--accent)] underline">
              PDF clasament încărcat
            </a>
            <button
              type="button"
              className="shrink-0 text-red-600 hover:underline"
              onClick={() => {
                const pdfAtt = form.attachments.find((a) => a.role === "LEADERBOARD");
                if (pdfAtt) void removeAttachment(pdfAtt.id);
                else patch("leaderboardPdfUrl", "");
              }}
            >
              Șterge
            </button>
          </div>
        ) : (
          <label className="grid gap-1 text-xs text-zinc-600">
            <span>Încarcă PDF clasament</span>
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload("LEADERBOARD", f); e.target.value = ""; }}
            />
          </label>
        )}
      </div>

      {/* Text paste + IRG generation */}
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-violet-50 p-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">Text pentru AI</h3>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">Corectare automată</span>
          </div>
          <p className="text-xs text-zinc-600">
            Deschide fiecare PDF, selectează tot (Ctrl+A), copiază (Ctrl+C) și lipește mai jos. AI-ul segmentează automat problemele și ignoră textul irelevant (regulament, antet etc.).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-xs font-semibold text-zinc-700">
              Text cerință (tot PDF-ul subiect)
              <span className="ml-1 font-normal text-zinc-400">opțional</span>
            </label>
            <textarea
              className="min-h-[160px] w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
              placeholder="Ctrl+A → Ctrl+C din PDF subiect, lipește aici…"
              value={form.statementText}
              onChange={(e) => patch("statementText", e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-semibold text-zinc-700">
              Text barem (tot PDF-ul barem)
              <span className="ml-1 font-normal text-red-500 ml-1">*obligatoriu pt. publicare</span>
            </label>
            <textarea
              className="min-h-[160px] w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
              placeholder="Ctrl+A → Ctrl+C din PDF barem, lipește aici…"
              value={form.rubricText}
              onChange={(e) => patch("rubricText", e.target.value)}
            />
          </div>
        </div>

        {/* Generate all rubrics */}
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-zinc-800">Rubrici AI</div>
              {allRubricsMatch ? (
                <div className="text-xs text-emerald-700">
                  {problemCount} rubrici generate ·{" "}
                  {form.problems.reduce((s, p) => {
                    const r = rubrics[p.orderNumber];
                    return s + (r?.rubric_breakdown.reduce((x, i) => x + i.allocated_points, 0) ?? 0);
                  }, 0)} puncte totale · <span className="font-medium">Blocate ✓</span>
                </div>
              ) : hasAnyRubric ? (
                <div className="text-xs text-amber-700">
                  Rubrici parțiale — {form.problems.filter((p) => rubrics[p.orderNumber]).length}/{problemCount} generate
                </div>
              ) : (
                <div className="text-xs text-zinc-500">
                  Nicio rubrică — apasă „Generează" după ce ai adăugat textul baremului.
                </div>
              )}
              {generatedCount !== null && generatedCount !== problemCount && (
                <div className="mt-1 text-xs text-red-700 font-medium">
                  AI a generat {generatedCount} rubrici, dar ai setat {problemCount} probleme — verifică numărul sau regenerează.
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={generating || !form.rubricText?.trim()}
                onClick={() => void generateAllRubrics()}
                className="text-xs flex items-center gap-1.5"
              >
                {generating && (
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {generating
                  ? "Se generează…"
                  : hasAnyRubric
                    ? "Regenerează toate"
                    : "Generează"}
              </Button>
              {hasAnyRubric && form.id ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs text-red-600"
                  onClick={() => void clearAllRubrics()}
                >
                  Șterge toate
                </Button>
              ) : null}
            </div>
            {generating && (
              <p className="text-xs text-zinc-500 mt-1 animate-pulse">
                Detectez structura baremului și generez rubricile… Poate dura 30–60 de secunde.
              </p>
            )}
          </div>

          {/* Per-problem rubric preview */}
          {form.problems.map((p) => {
            const rubric = rubrics[p.orderNumber];
            if (!rubric) return null;
            return (
              <div key={p.orderNumber} className="grid gap-1 border-t border-zinc-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-800">
                    Problema {p.orderNumber} — {rubric.rubric_breakdown.length} criterii · {rubric.rubric_breakdown.reduce((s, r) => s + r.allocated_points, 0)}p
                  </span>
                </div>
                <div className="grid gap-0.5">
                  {rubric.rubric_breakdown.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-2 py-1 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-zinc-900">{item.milestone_name}</span>
                        <span className="text-zinc-400 ml-2">{item.grading_criteria}</span>
                      </div>
                      <div className="shrink-0 font-semibold text-emerald-700 tabular-nums">{item.allocated_points}p</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-problem titles (optional) */}
        <div className="grid gap-2">
          <div className="text-xs font-semibold text-zinc-700">Titluri probleme <span className="font-normal text-zinc-400">(opțional)</span></div>
          <div className="grid gap-2 sm:grid-cols-3">
            {form.problems.map((p) => (
              <Input
                key={p.orderNumber}
                className="h-8 text-xs"
                placeholder={`Problema ${p.orderNumber}`}
                value={p.title === `Problema ${p.orderNumber}` ? "" : p.title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    problems: prev.problems.map((x) =>
                      x.orderNumber === p.orderNumber
                        ? { ...x, title: e.target.value || `Problema ${p.orderNumber}` }
                        : x,
                    ),
                  }))
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isPublished && (
          <Button type="button" variant="secondary" disabled={pending || uploading} onClick={() => save(ProblemStatus.DRAFT)}>
            {pending ? "Se salvează…" : "Salvează draft"}
          </Button>
        )}
        <Button type="button" disabled={pending || uploading} onClick={() => save(ProblemStatus.PUBLISHED)}>
          {pending ? "Se publică…" : isPublished ? "Salvează modificări" : "Publică concursul"}
        </Button>
        {form.id && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending || uploading}
            onClick={async () => {
              if (!confirm("Ești sigur că vrei să ștergi acest concurs? Acțiunea este ireversibilă.")) return;
              setPending(true);
              const res = await fetch(`/api/teacher/contest-sets/${form.id}`, { method: "DELETE" });
              setPending(false);
              if (res.ok) {
                router.push("/teacher/contest-sets");
                router.refresh();
              } else {
                const d = await res.json().catch(() => ({}));
                setError(d?.error ?? "Ștergerea a eșuat");
              }
            }}
          >
            Șterge concursul
          </Button>
        )}
      </div>
    </div>
  );
}
