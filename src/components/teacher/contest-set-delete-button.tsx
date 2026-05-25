"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContestSetDeleteButton({ id, title }: { id: string; title: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Ștergi "${title}"? Această acțiune este ireversibilă.`)) return;
    setLoading(true);
    await fetch(`/api/teacher/contest-sets/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {loading ? "Se șterge…" : "Șterge"}
    </button>
  );
}
