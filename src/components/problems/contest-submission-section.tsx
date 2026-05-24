"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type Problem = { id: string; orderNumber: number; title: string };
type Phase = "idle" | "uploading";

export function ContestSubmissionSection({
  contestSetId,
  problems,
  loggedIn,
}: {
  contestSetId: string;
  problems: Problem[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [selectedProblemId, setSelectedProblemId] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const busy = phase !== "idle";
  const selectedProblem = problems.find((p) => p.id === selectedProblemId) ?? null;

  React.useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  function addFiles(incoming: FileList | File[]) {
    setError(null);
    const arr = Array.from(incoming);
    const images = arr.filter((f) => f.type.startsWith("image/"));
    if (images.length !== arr.length) {
      setError("Te rugăm să folosești doar fișiere imagine (JPEG, PNG, WebP, …).");
      return;
    }
    const next = [...files, ...images].slice(0, 5);
    if (files.length + images.length > 5) {
      setError("Poți adăuga maxim 5 pagini per rezolvare.");
    }
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setFiles(next);
    setPreviewUrls(next.map((f) => URL.createObjectURL(f)));
  }

  function removeFile(idx: number) {
    URL.revokeObjectURL(previewUrls[idx]!);
    const nextFiles = files.filter((_, i) => i !== idx);
    const nextPreviews = previewUrls.filter((_, i) => i !== idx);
    setFiles(nextFiles);
    setPreviewUrls(nextPreviews);
    if (nextFiles.length === 0 && inputRef.current) inputRef.current.value = "";
  }

  function clearAll() {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviewUrls([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectProblem(id: string) {
    setSelectedProblemId(id);
    setError(null);
  }

  async function submit() {
    if (!selectedProblemId) { setError("Alege mai întâi o problemă."); return; }
    if (files.length === 0) { setError("Adaugă o imagine cu rezolvarea ta."); return; }
    setError(null);
    setPhase("uploading");

    const fd = new FormData();
    fd.set("contestSetProblemId", selectedProblemId);
    for (const f of files) fd.append("image", f);

    try {
      const res = await fetch("/api/submissions", { method: "POST", body: fd, credentials: "same-origin" });
      let data: { submission?: { id: string }; error?: string } = {};
      try { data = (await res.json()) as typeof data; } catch { data = {}; }

      if (!res.ok) {
        setError(data?.error ?? `Eroare ${res.status}`);
        setPhase("idle");
        return;
      }

      if (!data.submission?.id) {
        setError("Eroare internă: nu s-a primit ID-ul rezolvării.");
        setPhase("idle");
        return;
      }

      const orderNumber = selectedProblem!.orderNumber;
      router.push(`/contest-sets/${contestSetId}/problems/${orderNumber}`);
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
      setPhase("idle");
    }
  }

  if (!loggedIn) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600">
        <a href="/login" className="font-medium text-[color:var(--accent)] hover:underline">Autentifică-te</a> pentru a trimite o rezolvare.
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {/* Problem selector */}
      <div className="grid gap-2">
        <p className="text-sm font-medium text-zinc-900">La care problemă trimiți rezolvarea?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {problems.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => selectProblem(p.id)}
              className={cn(
                "rounded-xl border-2 px-3 py-3 text-left text-sm transition-colors",
                selectedProblemId === p.id
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8 font-semibold text-[color:var(--accent)]"
                  : "border-zinc-200 bg-white hover:border-zinc-300 text-zinc-800",
                busy && "cursor-not-allowed opacity-60",
              )}
            >
              <div className="font-semibold">Problema {p.orderNumber}</div>
              {p.title !== `Problema ${p.orderNumber}` && (
                <div className="mt-0.5 text-xs text-zinc-500 font-normal">{p.title}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upload area — shown once a problem is selected */}
      {selectedProblem && (
        <div className="grid gap-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            aria-hidden
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
          />

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (busy) return;
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); }
            }}
            onDragEnter={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (busy) return;
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            onClick={() => !busy && inputRef.current?.click()}
            className={cn(
              "cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:px-6",
              busy ? "cursor-not-allowed opacity-60" : "",
              dragOver ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8" : "border-zinc-200 bg-zinc-50/80",
            )}
          >
            <div className="text-sm font-medium text-zinc-900">
              Trage rezolvarea pentru Problema {selectedProblem.orderNumber}
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              {files.length === 0
                ? "sau apasă pentru a alege din galerie sau cameră"
                : `${files.length} imagine(i) selectată(e) — apasă pentru a adăuga mai multe`}
            </div>
            <Button type="button" variant="secondary" size="sm" className="mt-4 pointer-events-none" tabIndex={-1}>
              {files.length === 0 ? "Alege fișier" : "Adaugă pagini"}
            </Button>
          </div>

          {previewUrls.length > 0 && (
            <div className="grid gap-2">
              {previewUrls.map((url, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Pagina ${idx + 1}`} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900">{files[idx]!.name}</div>
                    <div className="text-xs text-zinc-500">Pagina {idx + 1}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 text-zinc-600"
                    disabled={busy}
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  >
                    Șterge
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" disabled={busy || files.length === 0} onClick={submit} className="min-w-[180px] shrink-0 shadow-sm">
              {phase === "uploading" ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4 border-white border-t-transparent" />
                  Se încarcă…
                </span>
              ) : (
                `Trimite — Problema ${selectedProblem.orderNumber}`
              )}
            </Button>
            {phase === "uploading" && (
              <div className="min-w-0 flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full w-full animate-pulse rounded-full bg-[color:var(--accent)]/70" />
                </div>
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <p className="text-xs leading-snug text-zinc-500">
            Până la 5 pagini, max 8&nbsp;MB fiecare. Fotografiază cu lumină bună pentru ca AI-ul să îți poată citi rezolvarea.
          </p>
        </div>
      )}
    </div>
  );
}
