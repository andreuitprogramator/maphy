"use client";

import * as React from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginClient({ nextHref, resetDone }: { nextHref: string; resetDone?: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const fd = new FormData(e.currentTarget);
    const identifier = String(fd.get("identifier") ?? "");
    const password = String(fd.get("password") ?? "");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Autentificarea a eșuat");
      return;
    }
    window.location.href = nextHref;
  }

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold tracking-tight">Autentifică-te</div>
            <div className="text-sm text-zinc-600">
              Nou aici?{" "}
              <Link className="text-[color:var(--accent)] hover:underline" href="/register">
                Creează un cont
              </Link>
              .
            </div>
          </CardHeader>
          <CardContent>
            {resetDone ? (
              <div className="mb-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                Parola a fost schimbată cu succes. Te poți autentifica.
              </div>
            ) : null}
            <form className="grid gap-3" onSubmit={onSubmit}>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Email sau username</label>
                <Input name="identifier" type="text" autoComplete="username" required />
              </div>
              <div className="grid gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-600">Parolă</label>
                  <Link className="text-xs text-zinc-500 hover:underline" href="/forgot-password">
                    Ai uitat parola?
                  </Link>
                </div>
                <Input name="password" type="password" autoComplete="current-password" required />
              </div>
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
              <Button disabled={pending} type="submit">
                {pending ? "Se autentifică…" : "Autentifică-te"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
