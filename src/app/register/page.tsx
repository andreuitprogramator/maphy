"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "");
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Registration failed");
      return;
    }
    router.push("/problems");
    router.refresh();
  }

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <div className="text-lg font-semibold tracking-tight">Create account</div>
            <div className="text-sm text-zinc-600">
              Already have one?{" "}
              <Link className="text-[color:var(--accent)] hover:underline" href="/login">
                Login
              </Link>
              .
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={onSubmit}>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Username</label>
                <Input name="username" autoComplete="username" required />
                <div className="text-xs text-zinc-500">Letters, numbers, underscore. 3–24 chars.</div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Email</label>
                <Input name="email" type="email" autoComplete="email" required />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Password</label>
                <Input name="password" type="password" autoComplete="new-password" required />
                <div className="text-xs text-zinc-500">Minimum 8 characters.</div>
              </div>
              {error ? <div className="text-sm text-red-600">{error}</div> : null}
              <Button disabled={pending} type="submit">
                {pending ? "Creating..." : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

