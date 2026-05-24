"use client";

import * as React from "react";
import { Phase, ProblemStatus, Subject } from "@prisma/client";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/teacher/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type TeacherProblemInitial = {
  id: string | null;
  title: string;
  summary: string;
  subject: Subject;
  year: number;
  class: number;
  phase: Phase;
  difficulty: number;
  statementHtml: string;
  officialSolutionHtml: string;
  status: ProblemStatus;
  rubricItems: { title: string; description: string; points: number }[];
  attachments: {
    id: string;
    fileUrl: string;
    fileType: string;
    mimeType: string;
    originalName: string;
    caption: string;
    role: string;
    uploadedAt: string;
  }[];
};

type AttachmentZoneProps = {
  label: string;
  description: string;
  attachments: TeacherProblemInitial["attachments"];
  pending: boolean;
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
};

function AttachmentZone({ label, description, attachments, pending, onUpload, onRemove }: AttachmentZoneProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-zinc-200 p-4">
      <div>
        <div className="text-sm font-medium text-zinc-900">{label}</div>
        <div className="text-xs text-zinc-500">{description}</div>
      </div>
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-200 py-6 text-center transition hover:border-zinc-400 hover:bg-zinc-50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onUpload(f);
        }}
      >
        <span className="text-xs font-medium text-zinc-700">Trage o poză aici sau apasă</span>
        <span className="text-xs text-zinc-400">JPG, PNG, WEBP — max 10MB</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onUpload(f);
              e.target.value = "";
            }
          }}
        />
      </label>
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-lg border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.fileUrl} alt={a.originalName} className="h-28 w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                disabled={pending}
                className="absolute right-1 top-1 rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-medium text-red-700 opacity-0 shadow transition group-hover:opacity-100"
              >
                Șterge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProblemPublishForm({ initial }: { initial: TeacherProblemInitial }) {
  const router = useRouter();
  const [problemId, setProblemId] = React.useState<string | null>(initial.id);
  const [title, setTitle] = React.useState(initial.title);
  const [summary, setSummary] = React.useState(initial.summary);
  const [subject, setSubject] = React.useState<Subject>(initial.subject);
  const [year, setYear] = React.useState(initial.year);
  const [cls, setCls] = React.useState(initial.class);
  const [phase, setPhase] = React.useState<Phase>(initial.phase);
  const [difficulty, setDifficulty] = React.useState(initial.difficulty);
  const [statementHtml, setStatementHtml] = React.useState(initial.statementHtml);
  const [solutionHtml, setSolutionHtml] = React.useState(initial.officialSolutionHtml);
  const [showTextEditors, setShowTextEditors] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [pendingAttachment, setPendingAttachment] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<string[]>([]);
  const [attachments, setAttachments] = React.useState(initial.attachments);

  const isPublished = initial.status === ProblemStatus.PUBLISHED;
  const statementAttachments = attachments.filter((a) => a.role === "STATEMENT");
  const rubricAttachments = attachments.filter((a) => a.role === "RUBRIC");

  function buildPayload(status: ProblemStatus) {
    return {
      title: title.trim() || "Fără titlu",
      summary: summary.trim() || null,
      subject,
      year,
      class: cls,
      phase,
      difficulty,
      statementHtml,
      officialSolutionHtml: solutionHtml,
      status,
      maxScore: 100,
      rubricItems: [],
    };
  }

  /** Creates a draft silently if one doesn't exist yet. Returns the problem id or null on failure. */
  async function ensureDraft(): Promise<string | null> {
    if (problemId) return problemId;
    const res = await fetch("/api/teacher/problems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload(ProblemStatus.DRAFT)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Nu s-a putut crea problema");
      return null;
    }
    const id: string = data?.problem?.id;
    if (!id) return null;
    setProblemId(id);
    // Update URL without triggering a full page re-render
    window.history.replaceState(null, "", `/teacher/problems/${id}/edit`);
    return id;
  }

  async function submit(status: ProblemStatus) {
    setError(null);
    setFieldErrors([]);

    const targetStatus = isPublished ? ProblemStatus.PUBLISHED : status;

    if (!title.trim()) {
      setFieldErrors(["Titlul este obligatoriu."]);
      return;
    }

    if (targetStatus === ProblemStatus.PUBLISHED && rubricAttachments.length === 0) {
      setFieldErrors(["Adaugă cel puțin o poză cu baremul."]);
      return;
    }

    setPending(true);
    const payload = buildPayload(targetStatus);
    const url = problemId ? `/api/teacher/problems/${problemId}` : `/api/teacher/problems`;
    const method = problemId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const msg = data?.error ?? "Nu s-a putut salva";
      setError(typeof msg === "string" ? msg : "Nu s-a putut salva");
      if (Array.isArray(data?.errors)) setFieldErrors(data.errors as string[]);
      return;
    }

    if (!problemId && data?.problem?.id) {
      const id: string = data.problem.id;
      setProblemId(id);
      window.history.replaceState(null, "", `/teacher/problems/${id}/edit`);
      return;
    }
    router.refresh();
  }

  async function deleteDraft() {
    if (!problemId || isPublished) return;
    setPending(true);
    const res = await fetch(`/api/teacher/problems/${problemId}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Nu s-a putut șterge");
      return;
    }
    router.push("/teacher/problems");
    router.refresh();
  }

  async function uploadAttachment(file: File, role: "STATEMENT" | "RUBRIC") {
    setError(null);
    setPendingAttachment(true);
    const id = await ensureDraft();
    if (!id) {
      setPendingAttachment(false);
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("role", role);
    const res = await fetch(`/api/teacher/problems/${id}/attachments`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setPendingAttachment(false);
    if (!res.ok) {
      setError(data?.error ?? "Încărcarea a eșuat");
      return;
    }
    if (data?.attachment) {
      setAttachments((prev) => [...prev, data.attachment]);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!problemId) return;
    setPendingAttachment(true);
    const res = await fetch(`/api/teacher/problems/${problemId}/attachments`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    setPendingAttachment(false);
    if (!res.ok) return;
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">{problemId ? "Editează problema" : "Problemă nouă"}</h2>
          <p className="text-sm text-zinc-500">
            Încarcă pozele cu cerința și baremul. AI-ul va corecta automat pe baza baremului.
          </p>
        </div>
        {isPublished ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">Publicată</span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">Draft</span>
        )}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}
      {fieldErrors.length > 0 ? (
        <ul className="list-inside list-disc rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {fieldErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      {/* Metadata */}
      <div className="grid gap-4">
        <div className="grid gap-1">
          <label className="text-xs text-zinc-600">Titlu</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-zinc-600">Rezumat scurt (opțional)</label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="O linie de previzualizare" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Materie</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              <option value={Subject.MATH}>Matematică</option>
              <option value={Subject.PHYSICS}>Fizică</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">An</label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Clasa</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={cls}
              onChange={(e) => setCls(Number(e.target.value))}
            >
              {Array.from({ length: 8 }).map((_, i) => {
                const v = i + 5;
                return <option key={v} value={v}>{v}</option>;
              })}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Etapă</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={phase}
              onChange={(e) => setPhase(e.target.value as Phase)}
            >
              <option value={Phase.LOCAL}>Locală</option>
              <option value={Phase.COUNTY}>Județeană</option>
              <option value={Phase.NATIONAL}>Națională</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Dificultate (1–10)</label>
            <Input type="number" min={1} max={10} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Punctaj maxim</label>
            <Input value={100} readOnly disabled className="bg-zinc-50 text-zinc-600" />
          </div>
        </div>
      </div>

      {/* Image upload zones */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AttachmentZone
          label="Cerință"
          description="Poze cu enunțul problemei"
          attachments={statementAttachments}
          pending={pendingAttachment}
          onUpload={(f) => uploadAttachment(f, "STATEMENT")}
          onRemove={removeAttachment}
        />
        <AttachmentZone
          label="Barem ✱"
          description="Poze cu baremul de corectare (obligatoriu)"
          attachments={rubricAttachments}
          pending={pendingAttachment}
          onUpload={(f) => uploadAttachment(f, "RUBRIC")}
          onRemove={removeAttachment}
        />
      </div>

      {/* Optional text editors — collapsed by default */}
      <div className="rounded-xl border border-zinc-200">
        <button
          type="button"
          onClick={() => setShowTextEditors((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <span>Enunț text (opțional, rar folosit)</span>
          <span className="text-zinc-400">{showTextEditors ? "▲" : "▼"}</span>
        </button>
        {showTextEditors && (
          <div className="grid gap-4 border-t border-zinc-200 p-4">
            <div className="grid gap-2">
              <div className="text-xs font-medium text-zinc-700">Enunț problemă</div>
              <RichTextEditor value={statementHtml} onChange={setStatementHtml} placeholder="Enunț complet…" />
            </div>
            <div className="grid gap-2">
              <div className="text-xs font-medium text-zinc-700">Soluție oficială</div>
              <RichTextEditor value={solutionHtml} onChange={setSolutionHtml} placeholder="Soluție model…" />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isPublished ? (
          <Button type="button" disabled={pending} onClick={() => submit(ProblemStatus.DRAFT)}>
            {pending ? "Se salvează…" : "Salvează draft"}
          </Button>
        ) : null}
        <Button type="button" disabled={pending} onClick={() => submit(ProblemStatus.PUBLISHED)}>
          {isPublished ? (pending ? "Se salvează…" : "Salvează modificările") : pending ? "Se publică…" : "Publică"}
        </Button>
        {problemId && !isPublished ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={deleteDraft}>
            Șterge draft
          </Button>
        ) : null}
      </div>
    </div>
  );
}
