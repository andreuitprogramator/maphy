"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function BaremReveal({ pdfUrl }: { pdfUrl: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="grid gap-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Ascunde baremul" : "Arată baremul"}
      </Button>
      {open && (
        <div className="rounded-xl border border-zinc-200 p-3">
          <div className="mb-2 text-sm font-medium text-zinc-900">Barem oficial</div>
          <iframe
            src={pdfUrl}
            className="h-[600px] w-full rounded-lg border border-zinc-200"
            title="PDF barem concurs"
          />
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-sm font-medium text-[color:var(--accent)] hover:underline"
          >
            Deschide PDF în tab nou
          </a>
        </div>
      )}
    </div>
  );
}
