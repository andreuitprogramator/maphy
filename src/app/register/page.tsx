"use client";

import * as React from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function firstIssue(issues: Record<string, string[] | undefined> | undefined, key: string) {
  return issues?.[key]?.[0];
}

export default function RegisterPage() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [successEmail, setSuccessEmail] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      username: String(fd.get("username") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
      firstName: String(fd.get("firstName") ?? "").trim(),
      lastName: String(fd.get("lastName") ?? "").trim(),
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Înregistrarea a eșuat");
      if (data?.issues && typeof data.issues === "object") {
        setFieldErrors(data.issues as Record<string, string[]>);
      }
      return;
    }
    setSuccessEmail(body.email);
  }

  if (successEmail) {
    return (
      <Container className="py-10">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <div className="text-lg font-semibold tracking-tight">Verifică-ți emailul</div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-zinc-600">
                Am trimis un link de confirmare la <span className="font-medium text-zinc-900">{successEmail}</span>.
                Apasă linkul din email pentru a-ți activa contul.
              </p>
              <p className="text-xs text-zinc-500">
                Nu ai primit emailul? Verifică folderul de spam. Linkul expiră în 24 de ore.
              </p>
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
            <div className="text-lg font-semibold tracking-tight">Creează cont</div>
            <div className="text-sm text-zinc-600">
              Ai deja cont?{" "}
              <Link className="text-[color:var(--accent)] hover:underline" href="/login">
                Autentifică-te
              </Link>
              .
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={onSubmit}>
              <div className="grid gap-1 sm:grid-cols-2 sm:gap-2">
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Prenume</label>
                  <Input name="firstName" autoComplete="given-name" required />
                  {firstIssue(fieldErrors, "firstName") ? (
                    <div className="text-xs text-red-600">{firstIssue(fieldErrors, "firstName")}</div>
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Nume</label>
                  <Input name="lastName" autoComplete="family-name" required />
                  {firstIssue(fieldErrors, "lastName") ? (
                    <div className="text-xs text-red-600">{firstIssue(fieldErrors, "lastName")}</div>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Nume utilizator</label>
                <Input name="username" autoComplete="username" required />
                <div className="text-xs text-zinc-500">Litere, cifre, underscore. 3–24 caractere.</div>
                {firstIssue(fieldErrors, "username") ? (
                  <div className="text-xs text-red-600">{firstIssue(fieldErrors, "username")}</div>
                ) : null}
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Email</label>
                <Input name="email" type="email" autoComplete="email" required />
                {firstIssue(fieldErrors, "email") ? (
                  <div className="text-xs text-red-600">{firstIssue(fieldErrors, "email")}</div>
                ) : null}
              </div>
              <div className="grid gap-1 sm:grid-cols-2 sm:gap-2">
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Parolă</label>
                  <Input name="password" type="password" autoComplete="new-password" required />
                  {firstIssue(fieldErrors, "password") ? (
                    <div className="text-xs text-red-600">{firstIssue(fieldErrors, "password")}</div>
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Confirmă parola</label>
                  <Input name="confirmPassword" type="password" autoComplete="new-password" required />
                  {firstIssue(fieldErrors, "confirmPassword") ? (
                    <div className="text-xs text-red-600">{firstIssue(fieldErrors, "confirmPassword")}</div>
                  ) : null}
                </div>
              </div>
              <div className="text-xs text-zinc-500">Minimum 8 caractere.</div>
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
              <Button disabled={pending} type="submit">
                {pending ? "Se creează…" : "Creează cont"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
