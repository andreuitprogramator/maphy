"use client";

import * as React from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, email }),
    });

    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "A apărut o eroare");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Container className="py-10">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <div className="text-lg font-semibold tracking-tight">Verifică-ți emailul</div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-zinc-600">
                Dacă adresa există în sistem, vei primi un email cu un link de resetare a parolei.
                Linkul expiră în 1 oră.
              </p>
              <p className="text-xs text-zinc-500">Nu ai primit emailul? Verifică folderul de spam.</p>
              <Link className="text-sm text-[color:var(--accent)] hover:underline" href="/login">
                Înapoi la autentificare
              </Link>
            </CardContent>
          </Card>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold tracking-tight">Ai uitat parola?</div>
            <div className="text-sm text-zinc-600">
              Introdu adresa de email și îți trimitem un link de resetare.
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={onSubmit}>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Nume utilizator</label>
                <Input name="username" autoComplete="username" required />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Email asociat contului</label>
                <Input name="email" type="email" autoComplete="email" required />
              </div>
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
              <Button disabled={pending} type="submit">
                {pending ? "Se trimite…" : "Trimite link de resetare"}
              </Button>
              <Link
                className="text-center text-sm text-zinc-500 hover:underline"
                href="/login"
              >
                Înapoi la autentificare
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
