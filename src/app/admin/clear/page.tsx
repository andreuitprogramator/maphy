"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClearContentPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClear() {
    if (!confirm("Ștergi TOT conținutul (probleme + seturi de concurs)? Ireversibil!")) return;
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/admin/clear-content", { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      setStatus(`Gata! Șterse: ${data.deleted.problems} probleme, ${data.deleted.contestSets} seturi de concurs.`);
      router.refresh();
    } else {
      setStatus(`Eroare: ${data.error ?? "necunoscută"}`);
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Ștergere conținut (doar pip)</h1>
        <button
          onClick={handleClear}
          disabled={loading}
          className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Se șterge…" : "Șterge tot conținutul"}
        </button>
        {status && <p className="text-sm text-zinc-700">{status}</p>}
      </div>
    </div>
  );
}
