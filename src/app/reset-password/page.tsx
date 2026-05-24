"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirmPassword") ?? "");
    if (password !== confirm) {
      setError("Parolele nu coincid");
      return;
    }
    setPending(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "A apărut o eroare");
      return;
    }
    router.push("/login?reset=1");
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <div className="grid gap-1">
        <label className="text-xs text-zinc-600">Parolă nouă</label>
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        <div className="text-xs text-zinc-500">Minimum 8 caractere.</div>
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-zinc-600">Confirmă parola</label>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <Button disabled={pending} type="submit">
        {pending ? "Se salvează…" : "Schimbă parola"}
      </Button>
    </form>
  );
}

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get("token");

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold tracking-tight">Resetează parola</div>
          </CardHeader>
          <CardContent>
            {token ? (
              <ResetPasswordForm token={token} />
            ) : (
              <div className="grid gap-3">
                <p className="text-sm text-red-600">Link invalid. Solicită un link nou.</p>
                <Link className="text-sm text-[color:var(--accent)] hover:underline" href="/forgot-password">
                  Solicită link nou
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
