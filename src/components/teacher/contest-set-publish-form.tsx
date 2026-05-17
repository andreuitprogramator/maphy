"use client";

import * as React from "react";
import { ProblemStatus, Subject } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/teacher/rich-text-editor";

type Stage = "LOCAL" | "COUNTY" | "NATIONAL" | "SELECTION" | "FINAL_ROUND" | "INTERNATIONAL" | "OTHER";
type StatementMode = "PDF_ONLY" | "TEXT_ONLY" | "BOTH";
type DisplayMode = "TEXT_FIRST" | "PDF_FIRST" | "PDF_ONLY" | "TEXT_ONLY";

type ProblemRow = { orderNumber: number; title: string; shortSummary: string; maxScore: number };
type AttachmentRole = "STATEMENT" | "RUBRIC" | "SUPPORTING" | "PROBLEM_STATEMENT" | "PROBLEM_RUBRIC";
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
  statementMode: StatementMode;
  statementDisplayMode: DisplayMode;
  statementText: string;
  statementPdfUrl: string;
  rubricPdfUrl: string;
  rubricText: string;
  status: ProblemStatus;
  problems: ProblemRow[];
  attachments: AttachmentRow[];
};

function SectionCard({
  title,
  badge,
  subtitle,
  variant,
  children,
}: {
  title: string;
  badge: string;
  subtitle: string;
  variant: "student" | "ai";
  children: React.ReactNode;
}) {
  const box =
    variant === "student"
      ? "border-sky-200 bg-sky-50/60"
      : "border-violet-200 bg-violet-50/60";
  const pill =
    variant === "student" ? "bg-sky-100 text-sky-900" : "bg-violet-100 text-violet-900";
  return (
    <section className={`grid gap-4 rounded-2xl border p-4 ${box}`}>
      <div className="grid gap-1">
        <SectionHeader title={title} badge={badge} pill={pill} />
        <p className="text-xs leading-relaxed text-zinc-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function SectionHeader({ title, badge, pill }: { title: string; badge: string; pill: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pill}`}>
        {badge}
      </span>
    </div>
  );
}

function AttachmentList({
  items,
  onRemove,
}: {
  items: AttachmentRow[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-zinc-500">Niciun fișier încărcat.</p>;
  }
  return (
    <ul className="grid gap-1">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
        >
          <a
            href={a.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate font-medium text-[color:var(--accent)] underline"
          >
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
  const [pending, setPending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<string[]>([]);
  const isPublished = initial.status === ProblemStatus.PUBLISHED;

  function patch<K extends keyof ContestSetInitial>(key: K, value: ContestSetInitial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function upload(
    role: AttachmentRole,
    file: File,
    options?: { problemOrderNumber?: number },
  ) {
    if (!form.id) {
      setError("Salvează mai întâi draft-ul (buton „Salvează draft”), apoi încarcă fișierele.");
      setInfo(null);
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set("role", role);
    fd.set("file", file);
    if (options?.problemOrderNumber != null) {
      fd.set("problemOrderNumber", String(options.problemOrderNumber));
    }
    const res = await fetch(`/api/teacher/contest-sets/${form.id}/attachments`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data?.error ?? "Încărcarea a eșuat.");
      return;
    }
    const att = data?.attachment as AttachmentRow | undefined;
    if (!att) return;
    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, att] }));
    if (role === "STATEMENT") patch("statementPdfUrl", att.fileUrl);
    if (role === "RUBRIC") patch("rubricPdfUrl", att.fileUrl);
    setInfo(`Încărcat: ${att.originalName}`);
  }

  async function removeAttachment(attachmentId: string) {
    if (!form.id) return;
    const res = await fetch(`/api/teacher/contest-sets/${form.id}/attachments`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    if (!res.ok) return;
    setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) }));
  }

  function problemImages(orderNumber: number, role: "PROBLEM_STATEMENT" | "PROBLEM_RUBRIC") {
    return form.attachments.filter(
      (a) =>
        a.role === role &&
        a.problemOrderNumber === orderNumber &&
        (a.fileType === "IMAGE" || (a.mimeType ?? "").startsWith("image/")),
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
      competitionName: form.competitionName,
      year: form.year,
      class: form.class,
      stage: form.stage,
      source: form.source || null,
      summary: form.summary || null,
      statementMode: form.statementMode,
      statementDisplayMode: form.statementDisplayMode,
      statementText: form.statementText || null,
      statementPdfUrl: form.statementPdfUrl || null,
      rubricPdfUrl: form.rubricPdfUrl || null,
      rubricText: form.rubricText || null,
      status: isPublished ? ProblemStatus.PUBLISHED : targetStatus,
      problems: form.problems.map((p, i) => ({
        ...p,
        orderNumber: Number(p.orderNumber) || i + 1,
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
    setInfo(targetStatus === ProblemStatus.PUBLISHED ? "Set publicat / actualizat." : "Draft salvat.");
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 pb-10">
      <div className="grid gap-1">
        <h2 className="text-xl font-semibold text-zinc-900">{form.id ? "Editează set de concurs" : "Set de concurs nou"}</h2>
        <p className="text-sm text-zinc-600">
          <span className="font-semibold text-sky-800">PDF-uri (secțiunea albastră)</span> — elevii le citesc pe site.{" "}
          <span className="font-semibold text-violet-800">Poze per problemă (secțiunea mov)</span> — le primește AI-ul la corectare.
        </p>
      </div>

      {!form.id ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Salvează draft-ul înainte de upload. După salvare revii pe aceeași pagină și poți încărca fișiere.
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}
      {info ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{info}{uploading ? " (upload în curs…)" : ""}</div> : null}
      {fieldErrors.length ? (
        <ul className="list-disc rounded-xl border border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-900">
          {fieldErrors.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1 sm:col-span-2"><label className="text-xs text-zinc-600">Titlu</label><Input value={form.title} onChange={(e) => patch("title", e.target.value)} /></div>
        <div className="grid gap-1"><label className="text-xs text-zinc-600">Materie</label><select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" value={form.subject} onChange={(e) => patch("subject", e.target.value as Subject)}><option value="MATH">Matematică</option><option value="PHYSICS">Fizică</option></select></div>
        <div className="grid gap-1"><label className="text-xs text-zinc-600">Competiție</label><Input value={form.competitionName} onChange={(e) => patch("competitionName", e.target.value)} /></div>
        <div className="grid gap-1"><label className="text-xs text-zinc-600">An</label><Input type="number" value={form.year} onChange={(e) => patch("year", Number(e.target.value))} /></div>
        <div className="grid gap-1"><label className="text-xs text-zinc-600">Clasă</label><Input type="number" value={form.class} onChange={(e) => patch("class", Number(e.target.value))} /></div>
        <div className="grid gap-1"><label className="text-xs text-zinc-600">Etapă</label><select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" value={form.stage} onChange={(e) => patch("stage", e.target.value as Stage)}>{["LOCAL","COUNTY","NATIONAL","SELECTION","FINAL_ROUND","INTERNATIONAL","OTHER"].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
      </div>

      <SectionCard
        title="PDF-uri pentru elevi"
        badge="Citire"
        subtitle="Încarcă subiectul și baremul complet (toate problemele). Elevii le deschid ca PDF; AI-ul NU folosește aceste PDF-uri dacă ai încărcat poze per problemă mai jos."
        variant="student"
      >
        <div className="grid gap-1"><label className="text-xs font-medium text-zinc-700">PDF subiect (complet)</label><Input value={form.statementPdfUrl} readOnly placeholder="Se completează după upload" className="bg-white" /></div>
        <label className="grid gap-1 text-xs text-zinc-600">
          <span>Încarcă PDF subiect</span>
          <input type="file" accept="application/pdf" disabled={!form.id || uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload("STATEMENT", f); e.target.value = ""; }} />
        </label>
        <div className="grid gap-1"><label className="text-xs font-medium text-zinc-700">PDF barem (complet)</label><Input value={form.rubricPdfUrl} readOnly placeholder="Se completează după upload" className="bg-white" /></div>
        <label className="grid gap-1 text-xs text-zinc-600">
          <span>Încarcă PDF barem</span>
          <input type="file" accept="application/pdf" disabled={!form.id || uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload("RUBRIC", f); e.target.value = ""; }} />
        </label>
        <details className="text-xs text-zinc-600"><summary className="cursor-pointer font-medium">Opțional: text subiect (editor)</summary><div className="mt-2"><RichTextEditor value={form.statementText || "<p></p>"} onChange={(v) => patch("statementText", v)} placeholder="Statement text" /></div></details>
      </SectionCard>

      <SectionCard
        title="Poze pentru AI grading"
        badge="Corectare automată"
        subtitle="Pentru fiecare problemă internă, încarcă poze clare doar cu cerința și doar cu baremul acelei probleme (poți adăuga mai multe poze dacă e lung)."
        variant="ai"
      >
        <div className="grid gap-2 rounded-xl border border-zinc-200 bg-white/80 p-3">
          <p className="text-sm font-medium text-zinc-900">Probleme interne</p>
          {form.problems.map((p, idx) => {
            const ai = problemAiStatus(p.orderNumber);
            return (
              <div key={`${idx}-${p.orderNumber}`} className="grid gap-3 rounded-xl border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900">Problema {p.orderNumber}</span>
                  <span className={`text-xs ${ai.ok ? "text-emerald-700" : "text-amber-700"}`}>
                    AI: cerință {ai.st ? "✓" : "✗"} · barem {ai.rb ? "✓" : "✗"}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input placeholder="Nr." type="number" value={p.orderNumber} onChange={(e) => setForm((prev) => ({ ...prev, problems: prev.problems.map((x, i) => i === idx ? { ...x, orderNumber: Number(e.target.value) } : x) }))} />
                  <Input placeholder="Titlu" value={p.title} onChange={(e) => setForm((prev) => ({ ...prev, problems: prev.problems.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} />
                  <Input placeholder="Rezumat (opțional)" value={p.shortSummary} onChange={(e) => setForm((prev) => ({ ...prev, problems: prev.problems.map((x, i) => i === idx ? { ...x, shortSummary: e.target.value } : x) }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2">
                    <label className="text-xs font-semibold text-violet-900">Poze cerință (doar problema {p.orderNumber})</label>
                    <input type="file" accept="image/*" multiple disabled={!form.id || uploading} onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => void upload("PROBLEM_STATEMENT", f, { problemOrderNumber: p.orderNumber })); e.target.value = ""; }} />
                    <AttachmentList items={problemImages(p.orderNumber, "PROBLEM_STATEMENT")} onRemove={removeAttachment} />
                  </div>
                  <div className="grid gap-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2">
                    <label className="text-xs font-semibold text-violet-900">Poze barem (doar problema {p.orderNumber})</label>
                    <input type="file" accept="image/*" multiple disabled={!form.id || uploading} onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => void upload("PROBLEM_RUBRIC", f, { problemOrderNumber: p.orderNumber })); e.target.value = ""; }} />
                    <AttachmentList items={problemImages(p.orderNumber, "PROBLEM_RUBRIC")} onRemove={removeAttachment} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        {!isPublished ? <Button type="button" disabled={pending || uploading} onClick={() => save(ProblemStatus.DRAFT)}>{pending ? "Se salvează…" : "Salvează draft"}</Button> : null}
        <Button type="button" disabled={pending || uploading} onClick={() => save(ProblemStatus.PUBLISHED)}>{pending ? "Se publică…" : isPublished ? "Salvează modificări" : "Publică"}</Button>
      </div>
    </div>
  );
}
