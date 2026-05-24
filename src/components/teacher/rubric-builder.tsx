"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export type RubricRow = {
  key: string;
  title: string;
  description: string;
  points: number;
};

function newRow(): RubricRow {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
    title: "",
    description: "",
    points: 0,
  };
}

export function RubricBuilder({
  items,
  onChange,
  disabled,
}: {
  items: RubricRow[];
  onChange: (next: RubricRow[]) => void;
  disabled?: boolean;
}) {
  const total = items.reduce((s, r) => s + (Number.isFinite(r.points) ? r.points : 0), 0);

  function update(i: number, patch: Partial<RubricRow>) {
    const next = items.map((row, j) => (j === i ? { ...row, ...patch } : row));
    onChange(next);
  }

  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-zinc-900">Barem de corectare</div>
        <div
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold tabular-nums",
            total === 100 ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950",
          )}
        >
          Total: {total} / 100
        </div>
      </div>
      <p className="text-xs text-zinc-600">
        Adaugă câte un rând per secțiune. Suma punctelor trebuie să fie exact 100 pentru a putea publica.
      </p>

      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
            Nicio secțiune încă. Adaugă primul rând din barem.
          </div>
        ) : null}
        {items.map((row, i) => (
          <div key={row.key} className="grid gap-3 rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-500">Secțiunea {i + 1}</span>
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="secondary" disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                  Sus
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={disabled || i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  Jos
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => remove(i)}>
                  Șterge
                </Button>
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-zinc-600">Etichetă</label>
              <Input
                value={row.title}
                disabled={disabled}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder='ex. „Diagrama forțelor corectă"'
              />
            </div>
            <div className="grid gap-1 sm:grid-cols-3 sm:items-end sm:gap-3">
              <div className="sm:col-span-1 grid gap-1">
                <label className="text-xs text-zinc-600">Puncte</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  disabled={disabled}
                  value={Number.isFinite(row.points) ? row.points : 0}
                  onChange={(e) => update(i, { points: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1">
                <label className="text-xs text-zinc-600">Ce trebuie să demonstreze elevul pentru a obține punctele</label>
                <textarea
                  disabled={disabled}
                  value={row.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  rows={3}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                  placeholder="Descrie ce trebuie să arate o rezolvare completă pentru această secțiune."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" disabled={disabled} onClick={() => onChange([...items, newRow()])}>
        Adaugă secțiune barem
      </Button>
    </div>
  );
}
