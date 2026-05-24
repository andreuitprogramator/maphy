"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type Phase = "idle" | "uploading" | "grading";

export function SubmissionForm({
  problemId,
  contestSetProblemId,
  disabled,
  onSubmitStart,
  onSubmitResult,
  onSubmitError,
}: {
  problemId?: string;
  contestSetProblemId?: string;
  disabled?: boolean;
  onSubmitStart?: () => void;
  onSubmitResult?: (submission: unknown) => void;
  onSubmitError?: () => void;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const busy = phase !== "idle";

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

  async function submit() {
    if (files.length === 0) {
      setError("Adaugă mai întâi o imagine — trage & plasează sau alege un fișier.");
      return;
    }
    setError(null);
    setPhase("uploading");
    onSubmitStart?.();

    const fd = new FormData();
    if (problemId) fd.set("problemId", problemId);
    if (contestSetProblemId) fd.set("contestSetProblemId", contestSetProblemId);
    for (const f of files) fd.append("image", f);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      let data: { submission?: unknown; error?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data?.error ?? `Încărcarea a eșuat (${res.status})`);
        onSubmitError?.();
        setPhase("idle");
        return;
      }

      if (data.submission == null) {
        setError("Răspuns invalid de la server. Încearcă din nou.");
        onSubmitError?.();
        setPhase("idle");
        return;
      }

      setPhase("grading");
      clearAll();
      onSubmitResult?.(data.submission);
      window.setTimeout(() => {
        setPhase("idle");
        router.refresh();
      }, 600);
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
      onSubmitError?.();
      setPhase("idle");
    }
  }

  const statusMessage =
    phase === "uploading"
      ? "Se încarcă rezolvarea…"
      : phase === "grading"
        ? "AI-ul corectează rezolvarea ta…"
        : null;

  return (
    <div className="grid gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || busy}
        className="sr-only"
        aria-hidden
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled || busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled && !busy) setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || busy) return;
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:px-6",
          disabled || busy ? "cursor-not-allowed opacity-60" : "",
          dragOver ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8" : "border-zinc-200 bg-zinc-50/80",
        )}
      >
        <div className="text-sm font-medium text-zinc-900">Trage rezolvarea ta aici</div>
        <div className="mt-1 text-xs text-zinc-600">
          {files.length === 0
            ? "sau apasă pentru a alege din galerie sau cameră"
            : `${files.length} imagine(i) selectată(e) — apasă pentru a adăuga mai multe`}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4 pointer-events-none"
          tabIndex={-1}
        >
          {files.length === 0 ? "Alege fișier" : "Adaugă pagini"}
        </Button>
      </div>

      {previewUrls.length > 0 ? (
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
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          disabled={disabled || busy || files.length === 0}
          onClick={submit}
          className="min-w-[140px] shrink-0 shadow-sm"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4 border-white border-t-transparent" />
              Se procesează…
            </span>
          ) : (
            "Trimite rezolvarea"
          )}
        </Button>
        {phase === "uploading" ? (
          <div className="min-w-0 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full w-full animate-pulse rounded-full bg-[color:var(--accent)]/70" />
            </div>
            <div className="mt-1 text-xs text-zinc-600 sm:text-left">Se încarcă…</div>
          </div>
        ) : null}
      </div>

      {statusMessage ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
          role="status"
          aria-live="polite"
        >
          <Spinner className="size-5 shrink-0 border-amber-600 border-t-transparent" />
          <div>
            <div className="font-medium">{statusMessage}</div>
            <div className="text-xs text-amber-900/80">Durează de obicei câteva secunde. Poți lăsa această pagină deschisă.</div>
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-snug text-zinc-500">
        Până la 5 pagini, max 8&nbsp;MB fiecare. Fotografiază cu lumină bună și imagine clară.
      </p>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
