"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import {
  AI_TEACHER_STYLE_OPTIONS,
  type AiTeacherStyleValue,
  isAiTeacherStyleValue,
} from "@/lib/ai/teacher-style-options";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type SettingsUserDTO = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  school: string;
  bio: string;
  avatarUrl: string | null;
  preferredLanguage: string;
  roleLabel: UserRole;
  aiTeacherStyle?: string | null;
  usernameChangedAt?: string | null;
  createdAt: string;
};


function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600">{msg}</p>;
}

function normalizeTeacherStyle(v: string | null | undefined): AiTeacherStyleValue {
  if (v && isAiTeacherStyleValue(v)) return v;
  return "SUPPORTIVE_TEACHER";
}

function TeacherRequestCard({ user }: { user: SettingsUserDTO }) {
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function sendRequest() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/teacher-request", { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "A apărut o eroare");
      return;
    }
    setDone(true);
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-medium text-zinc-900">Cont de profesor</div>
        <div className="text-sm text-zinc-600">
          Dacă ești profesor și vrei acces la funcționalitățile pentru profesori, trimite o cerere. O vei primi pe email după aprobare.
        </div>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm text-emerald-600">Cererea a fost trimisă. Vei fi contactat după aprobare.</p>
        ) : (
          <div className="grid gap-3">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button variant="secondary" disabled={pending} onClick={sendRequest} type="button">
              {pending ? "Se trimite…" : "Solicită acces profesor"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfileSettingsForm({ user }: { user: SettingsUserDTO }) {
  const [username, setUsername] = React.useState(user.username);
  const [firstName, setFirstName] = React.useState(user.firstName);
  const [lastName, setLastName] = React.useState(user.lastName);
  const [school, setSchool] = React.useState(user.school);
  const [bio, setbio] = React.useState(user.bio);
  const [preferredLanguage, setPreferredLanguage] = React.useState(user.preferredLanguage);
  const [aiTeacherStyle, setAiTeacherStyle] = React.useState<AiTeacherStyleValue>(() =>
    normalizeTeacherStyle(user.aiTeacherStyle),
  );

  React.useEffect(() => {
    setAiTeacherStyle(normalizeTeacherStyle(user.aiTeacherStyle));
  }, [user.aiTeacherStyle]);
  const [avatarUrl, setAvatarUrl] = React.useState(user.avatarUrl);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = React.useState(false);
  const [pendingAvatar, setPendingAvatar] = React.useState(false); // tracks avatar sub-step within saveProfile
  const [success, setSuccess] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pendingPassword, setPendingPassword] = React.useState(false);
  const [passwordSuccess, setPasswordSuccess] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Te rugăm să alegi un fișier imagine.");
      return;
    }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    setPendingProfile(true);

    // Upload avatar if a new file was selected
    const avatarFile = fileInputRef.current?.files?.[0];
    if (avatarFile) {
      setPendingAvatar(true);
      const fd = new FormData();
      fd.set("avatar", avatarFile);
      const avatarRes = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
      setPendingAvatar(false);
      const avatarData = await avatarRes.json().catch(() => ({}));
      if (!avatarRes.ok) {
        setPendingProfile(false);
        setError(avatarData?.error ?? "Încărcarea fotografiei a eșuat");
        return;
      }
      if (avatarData.avatarUrl) setAvatarUrl(avatarData.avatarUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        firstName,
        lastName,
        bio,
        school,
        preferredLanguage,
        aiTeacherStyle,
      }),
    });
    setPendingProfile(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Nu s-a putut salva profilul");
      if (data?.issues && typeof data.issues === "object") {
        setFieldErrors(data.issues as Record<string, string[]>);
      }
      return;
    }
    setSuccess("Profil actualizat.");
    if (data.user?.username) setUsername(data.user.username);
    setTimeout(() => window.location.replace("/settings"), 900);
  }

  const displayPhoto = previewUrl ?? avatarUrl;

  return (
    <Container className="py-8">
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Setări cont</h2>
            <p className="text-sm text-zinc-600">Actualizează cum apari pe Maphy.</p>
          </div>
          <Link className="text-sm font-medium text-[color:var(--accent)] hover:underline" href={`/u/${username}`}>
            Vezi profilul public
          </Link>
        </div>

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {success}
          </div>
        ) : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div> : null}

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Personalitatea profesorului AI</div>
            <div className="text-sm text-zinc-600">
              Cum ar trebui să sune AI-ul când îți scrie feedback pentru <em>rezolvările tale</em>? Punctajele și baremul rămân stricte — se schimbă doar tonul.
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {AI_TEACHER_STYLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 text-left transition-colors",
                  aiTeacherStyle === opt.value
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5"
                    : "border-zinc-200 bg-white hover:border-zinc-300",
                )}
              >
                <input
                  type="radio"
                  name="aiTeacherStyleRadio"
                  value={opt.value}
                  checked={aiTeacherStyle === opt.value}
                  onChange={() => setAiTeacherStyle(opt.value)}
                  className="mt-1 size-4 shrink-0 accent-[color:var(--accent)]"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900">{opt.label}</div>
                  <div className="text-xs text-zinc-600">{opt.shortDescription}</div>
                </div>
              </label>
            ))}
            <p className="text-xs text-zinc-500">
              Se aplică la următoarea rezolvare corectată după ce salvezi profilul (mai jos).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Fotografie de profil</div>
            <div className="text-sm text-zinc-600">JPG, PNG sau WebP. Max 4MB.</div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
              {displayPhoto ? (
                <Image src={displayPhoto} alt="" fill className="object-cover" sizes="96px" />
              ) : (
                <span className="grid h-full w-full place-items-center text-2xl font-semibold text-zinc-400">
                  {username.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className={cn(
                  "max-w-xs text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium",
                )}
              />
              {previewUrl ? (
                <p className="text-xs text-amber-600">Fotografie selectată — va fi salvată cu profilul.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Informații de bază</div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Prenume</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} name="firstName" required />
                  <FieldError msg={fieldErrors.firstName?.[0]} />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Nume</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} name="lastName" required />
                  <FieldError msg={fieldErrors.lastName?.[0]} />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Nume utilizator</label>
                {(() => {
                  const cooldownActive = (() => {
                    if (!user.usernameChangedAt) return null;
                    const next = new Date(user.usernameChangedAt);
                    next.setDate(next.getDate() + 7);
                    return new Date() < next ? next : null;
                  })();
                  return (
                    <>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} name="username" required disabled={!!cooldownActive} />
                      {cooldownActive ? (
                        <div className="text-xs text-amber-600">Poți schimba username-ul din nou pe {cooldownActive.toLocaleDateString("ro-RO")}.</div>
                      ) : null}
                    </>
                  );
                })()}
                <FieldError msg={fieldErrors.username?.[0]} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Email</label>
                <Input value={user.email} readOnly disabled className="bg-zinc-50 text-zinc-600" />
                <div className="text-xs text-zinc-500">Adresă de autentificare (contactează suportul pentru schimbare).</div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Școală / instituție</label>
                <Input value={school} onChange={(e) => setSchool(e.target.value)} name="school" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Descriere</label>
                <textarea
                  name="bio"
                  value={bio}
                  onChange={(e) => setbio(e.target.value)}
                  rows={4}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />
                <FieldError msg={fieldErrors.bio?.[0]} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Limbă preferată</label>
                <Input
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  placeholder="ex. ro, en"
                  name="preferredLanguage"
                />
              </div>
              <Button type="submit" disabled={pendingProfile}>
                {pendingAvatar ? "Se încarcă fotografia…" : pendingProfile ? "Se salvează…" : "Salvează profilul"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Schimbă parola</div>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordError(null);
                setPasswordSuccess(null);
                setPendingPassword(true);
                const res = await fetch("/api/users/me/password", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
                });
                setPendingPassword(false);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) { setPasswordError(data?.error ?? "Eroare la schimbarea parolei"); return; }
                setPasswordSuccess("Parola a fost schimbată.");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Parola actuală</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Parola nouă</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
                <div className="text-xs text-zinc-500">Minimum 8 caractere.</div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Confirmă parola nouă</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              {passwordError ? <div className="text-sm text-red-600">{passwordError}</div> : null}
              {passwordSuccess ? <div className="text-sm text-emerald-600">{passwordSuccess}</div> : null}
              <Button type="submit" disabled={pendingPassword}>
                {pendingPassword ? "Se schimbă…" : "Schimbă parola"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {user.roleLabel !== UserRole.TEACHER ? (
          <TeacherRequestCard user={user} />
        ) : null}

        <p className="text-center text-xs text-zinc-500">
          Membru din {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>
    </Container>
  );
}
