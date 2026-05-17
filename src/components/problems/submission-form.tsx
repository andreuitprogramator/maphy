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
  const [file, setFile] = React.useState<File | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const busy = phase !== "idle";

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function bindFile(f: File | null) {
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setFile(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please use an image file (JPEG, PNG, WebP, …).");
      return;
    }
    setFile(f);
    setFileName(f.name);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearFile() {
    bindFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!file) {
      setError("Add an image first — drag & drop or choose a file.");
      return;
    }
    setError(null);
    setPhase("uploading");
    onSubmitStart?.();

    const fd = new FormData();
    if (problemId) fd.set("problemId", problemId);
    if (contestSetProblemId) fd.set("contestSetProblemId", contestSetProblemId);
    fd.set("image", file);

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
        setError(data?.error ?? `Upload failed (${res.status})`);
        onSubmitError?.();
        setPhase("idle");
        return;
      }

      if (data.submission == null) {
        setError("Invalid server response. Please try again.");
        onSubmitError?.();
        setPhase("idle");
        return;
      }

      setPhase("grading");
      clearFile();
      onSubmitResult?.(data.submission);
      window.setTimeout(() => {
        setPhase("idle");
        router.refresh();
      }, 600);
    } catch {
      setError("Network error. Please try again.");
      onSubmitError?.();
      setPhase("idle");
    }
  }

  const statusMessage =
    phase === "uploading"
      ? "Uploading solution…"
      : phase === "grading"
        ? "AI is grading your submission…"
        : null;

  return (
    <div className="grid gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || busy}
        className="sr-only"
        aria-hidden
        onChange={(e) => bindFile(e.target.files?.[0] ?? null)}
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
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || busy) return;
          const f = e.dataTransfer.files?.[0];
          if (f) bindFile(f);
        }}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:px-6",
          disabled || busy ? "cursor-not-allowed opacity-60" : "",
          dragOver ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8" : "border-zinc-200 bg-zinc-50/80",
        )}
      >
        <div className="text-sm font-medium text-zinc-900">Drop your solution here</div>
        <div className="mt-1 text-xs text-zinc-600">or tap to choose from gallery or camera</div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4 pointer-events-none"
          tabIndex={-1}
        >
          Browse files
        </Button>
      </div>

      {fileName ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
          <span className="min-w-0 truncate font-medium text-zinc-900" title={fileName}>
            {fileName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-zinc-600"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
          >
            Remove
          </Button>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview */}
          <img src={previewUrl} alt="Preview of your solution" className="mx-auto max-h-64 w-full object-contain" />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          disabled={disabled || busy || !file}
          onClick={submit}
          className="min-w-[140px] shrink-0 shadow-sm"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4 border-white border-t-transparent" />
              Working…
            </span>
          ) : (
            "Submit solution"
          )}
        </Button>
        {phase === "uploading" ? (
          <div className="min-w-0 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full w-full animate-pulse rounded-full bg-[color:var(--accent)]/70" />
            </div>
            <div className="mt-1 text-xs text-zinc-600 sm:text-left">Uploading…</div>
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
            <div className="text-xs text-amber-900/80">This usually takes a few seconds. You can keep this tab open.</div>
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-snug text-zinc-500">
        Images up to 8&nbsp;MB. Use good lighting and sharp focus so the AI can read your work.
      </p>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
