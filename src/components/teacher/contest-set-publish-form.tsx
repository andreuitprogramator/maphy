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

function stageLabel(stage: Stage): string {
  return stage === "LOCAL" ? "Locală" : stage === "COUNTY" ? "Județeană" : stage === "NATIONAL" ? "Națională" : stage;
}

function autoTitle(subject: Subject, stage: Stage, year: number): string {
  const sub = subject === Subject.MATH ? "Matematică" : subject === Subject.PHYSICS ? "Fizică" : "Chimie";
  return `Olimpiada de ${sub} - Etapa ${stageLabel(stage)} ${year}`;
}

function AttachmentList({ items, onRemove }: { items: AttachmentRow[]; onRemove: (id: string) => void }) {
  if (items.length === 0) return <p className="text-xs text-zinc-500">Niciun fișier încărcat.</p>;
  return (
    <ul className="grid gap-1">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs">
          <a href={a.fileUrl} target="_blank" rel="noreferrer" className="truncate font-medium text-[color:var(--accent)] underline">
            {a.originalName}
          </a>
          <button type="button" className="shrink-0 text-red-600 hover:underline" onClick={() => onRemove(a.id)}>
            Șterge
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ContestSetPublishForm({ initial }: { initial: ContestSetInitial }) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial);
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
  const [rubricsLoading, setRubricsLoading] = React.useState<Record<number, boolean>>({});

  async function generateRubric(orderNumber: number) {
    const id = form.id ?? await ensureDraft();
    if (!id) return;
    setRubricsLoading((prev) => ({ ...prev, [orderNumber]: true }));
    try {
      const res = await fetch(`/api/teacher/contest-sets/${id}/generate-rubric`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Generarea rubricii a eșuat.");
        return;
      }
      setRubrics((prev) => ({ ...prev, [orderNumber]: data.rubric as MasterRubric }));
    } finally {
      setRubricsLoading((prev) => ({ ...prev, [orderNumber]: false }));
    }
  }

  async function clearRubric(orderNumber: number) {
    if (!form.id) return;
    await fetch(`/api/teacher/contest-sets/${form.id}/generate-rubric`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderNumber }),
    });
    setRubrics((prev) => ({ ...prev, [orderNumber]: null }));
  }

  // Auto-update title when subject/stage/year change (unless teacher manually edited it)
  React.useEffect(() => {
    if (!titleEdited) {
      setForm((prev) => ({ ...prev, title: autoTitle(prev.subject, prev.stage, prev.year) }));
    }
  }, [form.subject, form.stage, form.year, titleEdited]);

  function patch<K extends keyof ContestSetInitial>(key: K, value: ContestSetInitial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function ensureDraft(): Promise<string | null> {
    if (form.id) return form.id;
    const payload = {
      title: form.title || autoTitle(form.subject, form.stage, form.year),
      subject: form.subject,
      competitionName: form.title || autoTitle(form.subject, form.stage, form.year),
      year: form.year,
      class: form.class,
      stage: form.stage,
      statementMode: "PDF_ONLY",
      statementDisplayMode: "PDF_FIRST",
      status: "DRAFT",
      problems: form.problems.map((p, i) => ({
        orderNumber: p.orderNumber || i + 1,
        title: p.title || `Problema ${i + 1}`,
        maxScore: 100,
      })),
      attachments: [],
    };
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

  async function upload(role: AttachmentRole, file: File, options?: { problemOrderNumber?: number }) {
    setUploading(true);
    setError(null);
    try {
      const id = await ensureDraft();
      if (!id) return;
      const fd = new FormData();
      fd.set("role", role);
      fd.set("file", file);
      if (options?.problemOrderNumber != null) fd.set("problemOrderNumber", String(options.problemOrderNumber));
      const res = await fetch(`/api/teacher/contest-sets/${id}/attachments`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? `Eroare ${res.status} la încărcare.`); return; }
      const att = data?.attachment as AttachmentRow | undefined;
      if (!att) { setError("Răspuns invalid de la server."); return; }
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, att] }));
      if (role === "STATEMENT") patch("statementPdfUrl", att.fileUrl);
      if (role === "RUBRIC") patch("rubricPdfUrl", att.fileUrl);
      if (role === "LEADERBOARD") patch("leaderboardPdfUrl", att.fileUrl);
      setInfo(`Încărcat: ${att.originalName}`);
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

  function problemImages(orderNumber: number, role: "PROBLEM_STATEMENT" | "PROBLEM_RUBRIC") {
    return form.attachments.filter(
      (a) => a.role === role && a.problemOrderNumber === orderNumber && (a.fileType === "IMAGE" || (a.mimeType ?? "").startsWith("image/")),
    );
  }

  function problemAiStatus(orderNumber: number) {
    const st = problemImages(orderNumber, "PROBLEM_STATEMENT").length > 0;
    const rb = problemImages(orderNumber, "PROBLEM_RUBRIC").length > 0;
    return { st, rb, ok: st && rb };
  }

  async function save(targetStatus: ProblemStatus) {
    setPending(true);
    setError(null);
    setInfo(null);
    setFieldErrors([]);
    const payload = {
      title: form.title,
      subject: form.subject,
      competitionName: form.title,
      year: form.year,
      class: form.class,
      stage: form.stage,
      statementMode: "PDF_ONLY",
      statementDisplayMode: "PDF_FIRST",
      statementPdfUrl: form.statementPdfUrl || null,
      rubricPdfUrl: form.rubricPdfUrl || null,
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
    const res = await fetch(form.id ? `/api/teacher/contest-sets/${form.id}` : "/api/teacher/contest-sets", {
      method: form.id ? "PATCH" : "POST",
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
    if (!form.id && data?.contestSet?.id) {
      router.replace(`/teacher/contest-sets/${data.contestSet.id}/edit`);
      router.refresh();
      return;
    }
    setInfo(targetStatus === ProblemStatus.PUBLISHED ? "Concurs publicat." : "Draft salvat.");
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 pb-10">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold text-zinc-900">{form.id ? "Editează concurs" : "Concurs nou"}</h2>
        <p className="text-sm text-zinc-500">
          PDF-ul este cel pe care îl văd elevii. Pozele per problemă sunt folosite doar de AI la corectare.
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
              <option value="LOCAL">Locală</option>
              <option value="COUNTY">Județeană</option>
              <option value="NATIONAL">Națională</option>
            </select>
          </div>
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-zinc-600">Titlu (auto-generat, editabil)</label>
          <Input
            value={form.title}
            onChange={(e) => { setTitleEdited(true); patch("title", e.target.value); }}
          />
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

      {/* AI images per problem */}
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-violet-50 p-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">Poze pentru AI (per problemă)</h3>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900">Corectare automată</span>
          </div>
          <p className="text-xs text-zinc-600">
            Pentru fiecare din cele 3 probleme: poze clare cu cerința și cu baremul acelei probleme. AI-ul le folosește la corectare.
          </p>
        </div>

        <div className="grid gap-3">
          {form.problems.map((p) => {
            const ai = problemAiStatus(p.orderNumber);
            return (
              <div key={p.orderNumber} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">Problema {p.orderNumber}</span>
                    <span className={`text-xs font-medium ${ai.ok ? "text-emerald-700" : "text-amber-700"}`}>
                      AI: cerință {ai.st ? "✓" : "✗"} · barem {ai.rb ? "✓" : "✗"}
                    </span>
                  </div>
                  <Input
                    className="h-8 max-w-[220px] text-xs"
                    placeholder={`Titlu problemă ${p.orderNumber} (opțional)`}
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
                </div>
                <div className="grid gap-x-4 gap-y-3 border-t border-zinc-200 pt-3 sm:grid-cols-2">
                  {(["PROBLEM_STATEMENT", "PROBLEM_RUBRIC"] as const).map((role) => (
                    <div key={role} className="grid gap-2">
                      <div className="text-xs font-semibold text-zinc-700">
                        {role === "PROBLEM_STATEMENT" ? "Poze cerință" : "Poze barem"}
                      </div>
                      <label className={`flex cursor-pointer items-center gap-1.5 self-start rounded-md border border-dashed px-2.5 py-1.5 text-xs transition ${uploading ? "cursor-not-allowed border-zinc-200 text-zinc-400 opacity-60" : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100"}`}>
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Adaugă poze</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploading}
                          className="sr-only"
                          onChange={(e) => {
                            Array.from(e.target.files ?? []).forEach((f) =>
                              void upload(role, f, { problemOrderNumber: p.orderNumber }),
                            );
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <AttachmentList items={problemImages(p.orderNumber, role)} onRemove={removeAttachment} />
                    </div>
                  ))}
                </div>

                {/* Rubric generation */}
                <div className="grid gap-2 border-t border-zinc-200 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-zinc-800">
                        Rubrica AI — Problema {p.orderNumber}
                      </div>
                      {rubrics[p.orderNumber] ? (
                        <div className="text-xs text-emerald-700">
                          {rubrics[p.orderNumber]!.rubric_breakdown.length} criterii ·{" "}
                          {rubrics[p.orderNumber]!.rubric_breakdown.reduce((s, r) => s + r.allocated_points, 0)} puncte totale
                          {" "}· <span className="font-medium">Blocată ✓</span>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500">Nicio rubrică generată — corectorul va genera una la fiecare trimitere.</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={rubricsLoading[p.orderNumber] || uploading || !ai.rb}
                        onClick={() => void generateRubric(p.orderNumber)}
                        className="text-xs"
                      >
                        {rubricsLoading[p.orderNumber]
                          ? "Se generează…"
                          : rubrics[p.orderNumber]
                            ? "Regenerează"
                            : "Generează rubrici"}
                      </Button>
                      {rubrics[p.orderNumber] && form.id ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs text-red-600"
                          onClick={() => void clearRubric(p.orderNumber)}
                        >
                          Șterge
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {!ai.rb && (
                    <p className="text-xs text-amber-700">Adaugă mai întâi pozele baremului pentru a putea genera rubrica.</p>
                  )}
                  {rubrics[p.orderNumber] ? (
                    <div className="grid gap-1">
                      {rubrics[p.orderNumber]!.rubric_breakdown.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 border-b border-zinc-100 py-1.5 text-xs last:border-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-zinc-900">{item.milestone_name}</div>
                            <div className="text-zinc-500 mt-0.5">{item.grading_criteria}</div>
                          </div>
                          <div className="shrink-0 font-semibold text-emerald-700 tabular-nums">{item.allocated_points}p</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
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
