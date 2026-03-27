"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubmissionForm({ problemId, disabled }: { problemId: string; disabled?: boolean }) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("problemId", problemId);
    fd.set("image", file);

    const res = await fetch("/api/submissions", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Upload failed");
      return;
    }
    setFile(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
        <Input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled || pending}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" disabled={disabled || pending} onClick={submit}>
          {pending ? "Uploading..." : "Submit"}
        </Button>
      </div>
      <div className="text-xs text-zinc-500">
        Mobile-friendly: you can open the camera or pick from gallery.
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

