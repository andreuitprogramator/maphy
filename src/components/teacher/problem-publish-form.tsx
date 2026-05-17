"use client";

import * as React from "react";
import { Phase, ProblemStatus, Subject } from "@prisma/client";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/teacher/rich-text-editor";
import { RubricBuilder, type RubricRow } from "@/components/teacher/rubric-builder";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { rubricPointsTotal } from "@/lib/problems/rubric-format";
import { hasMeaningfulRichText } from "@/lib/html/strip";

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
    uploadedAt: string;
  }[];
};

function rowsFromInitial(items: TeacherProblemInitial["rubricItems"]): RubricRow[] {
  return items.map((r) => ({
    key: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
    title: r.title,
    description: r.description,
    points: r.points,
  }));
}

export function ProblemPublishForm({ initial }: { initial: TeacherProblemInitial }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initial.title);
  const [summary, setSummary] = React.useState(initial.summary);
  const [subject, setSubject] = React.useState<Subject>(initial.subject);
  const [year, setYear] = React.useState(initial.year);
  const [cls, setCls] = React.useState(initial.class);
  const [phase, setPhase] = React.useState<Phase>(initial.phase);
  const [difficulty, setDifficulty] = React.useState(initial.difficulty);
  const [statementHtml, setStatementHtml] = React.useState(initial.statementHtml);
  const [solutionHtml, setSolutionHtml] = React.useState(initial.officialSolutionHtml);
  const [rubricRows, setRubricRows] = React.useState<RubricRow[]>(() => rowsFromInitial(initial.rubricItems));
  const [pending, setPending] = React.useState(false);
  const [pendingAttachment, setPendingAttachment] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<string[]>([]);
  const [attachments, setAttachments] = React.useState(initial.attachments);
  const [attachmentCaption, setAttachmentCaption] = React.useState("");
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);

  const isPublished = initial.status === ProblemStatus.PUBLISHED;
  const rubricTotal = rubricPointsTotal(rubricRows);

  function buildPayload(status: ProblemStatus) {
    return {
      title,
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
      rubricItems: rubricRows.map((r) => ({
        title: r.title,
        description: r.description,
        points: r.points,
      })),
    };
  }

  async function submit(status: ProblemStatus) {
    setError(null);
    setFieldErrors([]);

    const targetStatus = isPublished ? ProblemStatus.PUBLISHED : status;

    if (!title.trim()) {
      setFieldErrors(["Title is required."]);
      return;
    }

    if (targetStatus === ProblemStatus.PUBLISHED) {
      const local: string[] = [];
      if (!hasMeaningfulRichText(statementHtml, 8)) local.push("Problem statement is required.");
      if (!hasMeaningfulRichText(solutionHtml, 8)) local.push("Official solution is required.");
      const meaningfulRows = rubricRows.filter(
        (r) => r.title.trim() || r.description.trim() || r.points > 0,
      );
      if (meaningfulRows.length < 1) local.push("Add at least one rubric section.");
      if (rubricTotal !== 100) local.push(`Rubric must total 100 points (currently ${rubricTotal}).`);
      for (let i = 0; i < meaningfulRows.length; i++) {
        const r = meaningfulRows[i]!;
        if (!r.title.trim()) local.push(`Rubric row ${i + 1}: add a label.`);
        if (!r.description.trim()) local.push(`Rubric row ${i + 1}: add expected evidence.`);
        if (r.points <= 0) local.push(`Rubric row ${i + 1}: points must be greater than zero.`);
      }
      if (local.length) {
        setFieldErrors(local);
        return;
      }
    }

    setPending(true);
    const payload = buildPayload(targetStatus);
    const url = initial.id ? `/api/teacher/problems/${initial.id}` : `/api/teacher/problems`;
    const method = initial.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      const msg = data?.error ?? "Could not save";
      setError(typeof msg === "string" ? msg : "Could not save");
      if (Array.isArray(data?.errors)) setFieldErrors(data.errors as string[]);
      return;
    }

    if (!initial.id && data?.problem?.id) {
      router.replace(`/teacher/problems/${data.problem.id}/edit`);
      router.refresh();
      return;
    }
    router.refresh();
    if (targetStatus === ProblemStatus.PUBLISHED) {
      setError(null);
    }
  }

  async function deleteDraft() {
    if (!initial.id || isPublished) return;
    setPending(true);
    const res = await fetch(`/api/teacher/problems/${initial.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Could not delete");
      return;
    }
    router.push("/teacher/problems");
    router.refresh();
  }

  async function uploadAttachment(file: File) {
    if (!initial.id) {
      setError("Save the draft first, then upload attachments.");
      return;
    }
    setError(null);
    setPendingAttachment(true);
    const fd = new FormData();
    fd.set("file", file);
    if (attachmentCaption.trim()) fd.set("caption", attachmentCaption.trim());
    const res = await fetch(`/api/teacher/problems/${initial.id}/attachments`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setPendingAttachment(false);
    if (!res.ok) {
      setError(data?.error ?? "Attachment upload failed");
      return;
    }
    if (data?.attachment) {
      setAttachments((prev) => [...prev, data.attachment]);
      setAttachmentCaption("");
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!initial.id) return;
    setPendingAttachment(true);
    const res = await fetch(`/api/teacher/problems/${initial.id}/attachments`, {
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
          <h2 className="text-xl font-semibold text-zinc-900">{initial.id ? "Edit problem" : "New problem"}</h2>
          <p className="text-sm text-zinc-600">
            Write the statement and solution in the rich editor. Rubric sections define how the AI awards the 100
            points.
          </p>
        </div>
        {isPublished ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">Published</span>
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

      <div className="grid gap-4">
        <div className="grid gap-1">
          <label className="text-xs text-zinc-600">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-zinc-600">Short summary (optional)</label>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One-line preview for lists" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Subject</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              <option value={Subject.MATH}>Math</option>
              <option value={Subject.PHYSICS}>Physics</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Year</label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Class</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={cls}
              onChange={(e) => setCls(Number(e.target.value))}
            >
              {Array.from({ length: 8 }).map((_, i) => {
                const v = i + 5;
                return (
                  <option key={v} value={v}>
                    {v}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Phase</label>
            <select
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              value={phase}
              onChange={(e) => setPhase(e.target.value as Phase)}
            >
              <option value={Phase.LOCAL}>Local</option>
              <option value={Phase.COUNTY}>County</option>
              <option value={Phase.NATIONAL}>National</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Difficulty (1–10)</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-zinc-600">Max score</label>
            <Input value={100} readOnly disabled className="bg-zinc-50 text-zinc-600" />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium text-zinc-900">Problem statement</div>
        <RichTextEditor value={statementHtml} onChange={setStatementHtml} placeholder="Full problem statement…" />
      </div>

      <div className="grid gap-2">
        <div className="text-sm font-medium text-zinc-900">Official solution</div>
        <RichTextEditor value={solutionHtml} onChange={setSolutionHtml} placeholder="Model solution for graders…" />
      </div>

      <RubricBuilder items={rubricRows} onChange={setRubricRows} disabled={pending} />

      <div className="grid gap-3 rounded-xl border border-zinc-200 p-4">
        <div>
          <div className="text-sm font-medium text-zinc-900">Attachments (optional)</div>
          <div className="text-xs text-zinc-600">
            Add figure images or an official PDF. Allowed: images and PDF files.
          </div>
        </div>
        {!initial.id ? (
          <div className="text-xs text-zinc-600">Save draft first to enable uploads.</div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={attachmentCaption}
                onChange={(e) => setAttachmentCaption(e.target.value)}
                placeholder="Optional caption (e.g. Figure 1)"
              />
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAttachment(f);
                }}
                disabled={pendingAttachment}
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium"
              />
            </div>
            <div className="grid gap-2">
              {attachments.length === 0 ? (
                <div className="text-xs text-zinc-500">No attachments uploaded.</div>
              ) : (
                attachments.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                    <a className="min-w-0 truncate font-medium text-[color:var(--accent)] hover:underline" href={a.fileUrl} target="_blank" rel="noreferrer">
                      {a.fileType === "PDF" ? "PDF" : "Image"} · {a.caption?.trim() || a.originalName}
                    </a>
                    <Button type="button" size="sm" variant="secondary" onClick={() => removeAttachment(a.id)} disabled={pendingAttachment}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isPublished ? (
          <Button type="button" disabled={pending} onClick={() => submit(ProblemStatus.DRAFT)}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
        ) : null}
        <Button type="button" disabled={pending} onClick={() => submit(ProblemStatus.PUBLISHED)}>
          {isPublished ? (pending ? "Saving…" : "Save changes") : pending ? "Publishing…" : "Publish"}
        </Button>
        {initial.id && !isPublished ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={deleteDraft}>
            Delete draft
          </Button>
        ) : null}
      </div>
    </div>
  );
}
