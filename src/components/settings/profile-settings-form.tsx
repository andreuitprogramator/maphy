"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  country: string;
  city: string;
  school: string;
  bio: string;
  avatarUrl: string | null;
  preferredLanguage: string;
  roleLabel: UserRole;
  /** From DB; may be missing on stale clients. */
  aiTeacherStyle?: string | null;
  createdAt: string;
};

const roleOptionsAll: { value: UserRole; label: string }[] = [
  { value: UserRole.STUDENT, label: "Student" },
  { value: UserRole.TEACHER, label: "Teacher" },
  { value: UserRole.OTHER, label: "Other" },
];

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600">{msg}</p>;
}

function normalizeTeacherStyle(v: string | null | undefined): AiTeacherStyleValue {
  if (v && isAiTeacherStyleValue(v)) return v;
  return "SUPPORTIVE_TEACHER";
}

export function ProfileSettingsForm({ user }: { user: SettingsUserDTO }) {
  const router = useRouter();
  const roleOptions =
    user.roleLabel === UserRole.TEACHER
      ? roleOptionsAll.filter((r) => r.value !== UserRole.STUDENT)
      : roleOptionsAll;
  const [username, setUsername] = React.useState(user.username);
  const [firstName, setFirstName] = React.useState(user.firstName);
  const [lastName, setLastName] = React.useState(user.lastName);
  const [country, setCountry] = React.useState(user.country);
  const [city, setCity] = React.useState(user.city);
  const [school, setSchool] = React.useState(user.school);
  const [bio, setbio] = React.useState(user.bio);
  const [preferredLanguage, setPreferredLanguage] = React.useState(user.preferredLanguage);
  const [roleLabel, setRoleLabel] = React.useState<UserRole>(user.roleLabel);
  const [aiTeacherStyle, setAiTeacherStyle] = React.useState<AiTeacherStyleValue>(() =>
    normalizeTeacherStyle(user.aiTeacherStyle),
  );

  React.useEffect(() => {
    setAiTeacherStyle(normalizeTeacherStyle(user.aiTeacherStyle));
  }, [user.aiTeacherStyle]);
  const [avatarUrl, setAvatarUrl] = React.useState(user.avatarUrl);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = React.useState(false);
  const [pendingAvatar, setPendingAvatar] = React.useState(false);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
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
      setError("Please choose an image file.");
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
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        firstName,
        lastName,
        bio,
        country,
        city,
        school,
        preferredLanguage,
        roleLabel,
        aiTeacherStyle,
      }),
    });
    setPendingProfile(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Could not save profile");
      if (data?.issues && typeof data.issues === "object") {
        setFieldErrors(data.issues as Record<string, string[]>);
      }
      return;
    }
    setSuccess("Profile updated.");
    if (data.user?.username) setUsername(data.user.username);
    router.refresh();
  }

  async function uploadAvatar() {
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setError(null);
    setSuccess(null);
    setPendingAvatar(true);
    const fd = new FormData();
    fd.set("avatar", file);
    const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
    setPendingAvatar(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Upload failed");
      return;
    }
    if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (input) input.value = "";
    setSuccess("Profile photo updated.");
    router.refresh();
  }

  const displayPhoto = previewUrl ?? avatarUrl;

  return (
    <Container className="py-8">
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Account settings</h2>
            <p className="text-sm text-zinc-600">Update how you appear on Maphy.</p>
          </div>
          <Link className="text-sm font-medium text-[color:var(--accent)] hover:underline" href={`/u/${username}`}>
            View public profile
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
            <div className="text-sm font-medium text-zinc-900">AI teacher personality</div>
            <div className="text-sm text-zinc-600">
              How should the AI sound when it writes feedback on <em>your</em> submissions? Scoring and rubrics stay
              strict—only tone changes.
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
              Applies on your next graded submission after you save profile (below).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Profile photo</div>
            <div className="text-sm text-zinc-600">JPG, PNG, or WebP. Max 4MB.</div>
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
              <Button type="button" size="sm" variant="secondary" disabled={pendingAvatar} onClick={uploadAvatar}>
                {pendingAvatar ? "Uploading…" : "Save new photo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Basic info</div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} name="firstName" required />
                  <FieldError msg={fieldErrors.firstName?.[0]} />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Last name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} name="lastName" required />
                  <FieldError msg={fieldErrors.lastName?.[0]} />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Username</label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} name="username" required />
                <FieldError msg={fieldErrors.username?.[0]} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Email</label>
                <Input value={user.email} readOnly disabled className="bg-zinc-50 text-zinc-600" />
                <div className="text-xs text-zinc-500">Email sign-in address (contact support to change).</div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Country</label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} name="country" />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} name="city" />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">School / institution</label>
                <Input value={school} onChange={(e) => setSchool(e.target.value)} name="school" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-zinc-600">Bio</label>
                <textarea
                  name="bio"
                  value={bio}
                  onChange={(e) => setbio(e.target.value)}
                  rows={4}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                />
                <FieldError msg={fieldErrors.bio?.[0]} />
              </div>
              <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Preferred language</label>
                  <Input
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    placeholder="e.g. en, ro"
                    name="preferredLanguage"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-zinc-600">Role</label>
                  <select
                    name="roleLabel"
                    value={roleLabel}
                    onChange={(e) => setRoleLabel(e.target.value as UserRole)}
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2"
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {user.roleLabel === UserRole.TEACHER ? (
                    <div className="text-xs text-zinc-500">Teacher accounts cannot switch back to Student.</div>
                  ) : null}
                </div>
              </div>
              <Button type="submit" disabled={pendingProfile}>
                {pendingProfile ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-zinc-500">
          Member since {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>
    </Container>
  );
}
