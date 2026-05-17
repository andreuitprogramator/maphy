import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfileSubmissionsList } from "@/components/profile/profile-submissions-list";
import { MessageUserButton } from "@/components/social/message-user-button";
import { ProfileConnectionsPanel } from "@/components/social/profile-connections-panel";
import { serializeProfileSubmissionsForClient } from "@/lib/problems/submission-display";

export const dynamic = "force-dynamic";

function formatRole(role: UserRole) {
  switch (role) {
    case UserRole.STUDENT:
      return "Student";
    case UserRole.TEACHER:
      return "Teacher";
    case UserRole.OTHER:
      return "Other";
    default:
      return role;
  }
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const me = await getSessionUser();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      country: true,
      city: true,
      school: true,
      bio: true,
      avatarUrl: true,
      preferredLanguage: true,
      roleLabel: true,
      createdAt: true,
    },
  });
  if (!user) return notFound();

  const isOwnProfile = me?.id === user.id;
  const displayName = [user.firstName.trim(), user.lastName.trim()].filter(Boolean).join(" ");
  const [submissions, allSubmissionsAgg, gradedAgg, followers, following, isFollowing, isFollowedBy, authoredProblems, authoredContestSets] =
    await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id, problemId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        aiScore: true,
        aiFeedback: true,
        aiBreakdown: true,
        reviewedAt: true,
        imageQualityReason: true,
        createdAt: true,
        imageUrl: true,
        problem: { select: { id: true, title: true } },
      },
    }),
    prisma.submission.aggregate({
      where: { userId: user.id, problemId: { not: null } },
      _count: { _all: true },
    }),
    prisma.submission.aggregate({
      where: { userId: user.id, problemId: { not: null }, status: "GRADED", aiScore: { not: null } },
      _count: { _all: true },
      _avg: { aiScore: true },
    }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    me
      ? prisma.follow
          .findUnique({
            where: { followerId_followingId: { followerId: me.id, followingId: user.id } },
            select: { followerId: true },
          })
          .then((x) => Boolean(x))
      : false,
    me
      ? prisma.follow
          .findUnique({
            where: { followerId_followingId: { followerId: user.id, followingId: me.id } },
            select: { followerId: true },
          })
          .then((x) => Boolean(x))
      : false,
    user.roleLabel === UserRole.TEACHER
      ? prisma.problem.findMany({
          where: {
            createdById: user.id,
            ...(!isOwnProfile ? { status: ProblemStatus.PUBLISHED } : {}),
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 40,
          select: {
            id: true,
            title: true,
            status: true,
            year: true,
            subject: true,
            phase: true,
            class: true,
          },
        })
      : Promise.resolve(
          [] as {
            id: string;
            title: string;
            status: ProblemStatus;
            year: number;
            subject: string;
            phase: string;
            class: number;
          }[],
        ),
    user.roleLabel === UserRole.TEACHER
      ? prisma.contestSet.findMany({
          where: {
            createdById: user.id,
            ...(!isOwnProfile ? { status: ProblemStatus.PUBLISHED } : {}),
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 20,
          select: {
            id: true,
            title: true,
            status: true,
            year: true,
            subject: true,
            stage: true,
            totalProblemCount: true,
          },
        })
      : Promise.resolve(
          [] as {
            id: string;
            title: string;
            status: ProblemStatus;
            year: number;
            subject: string;
            stage: string;
            totalProblemCount: number;
          }[],
        ),
  ]);
  const canMessage = Boolean(me && !isOwnProfile);

  return (
    <Container className="py-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                  {user.avatarUrl ? (
                    <Image src={user.avatarUrl} alt="" fill className="object-cover" sizes="64px" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-lg font-semibold text-zinc-500">
                      {user.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold tracking-tight">@{user.username}</div>
                  {displayName ? <div className="text-sm text-zinc-700">{displayName}</div> : null}
                  <div className="mt-1 text-xs text-zinc-500">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {me && !isOwnProfile ? (
                  <FollowButton username={user.username} initialFollowing={isFollowing} />
                ) : null}
                {canMessage ? <MessageUserButton username={user.username} /> : null}
                {me && !isOwnProfile && !(isFollowing && isFollowedBy) ? (
                  <div className="max-w-44 text-right text-[11px] text-zinc-500">
                    Mutual follow required for direct messages.
                  </div>
                ) : null}
                {isOwnProfile ? (
                  <Link
                    className="text-xs font-medium text-[color:var(--accent)] hover:underline"
                    href="/settings"
                  >
                    Edit profile
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {user.bio.trim() ? (
                <div className="text-sm text-zinc-700 whitespace-pre-wrap">{user.bio}</div>
              ) : (
                <div className="text-sm italic text-zinc-400">No bio yet.</div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-zinc-700">
                {[user.country.trim(), user.city.trim()].filter(Boolean).length > 0 ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-800">
                    {[user.country.trim(), user.city.trim()].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                {user.school.trim() ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-800">
                    {user.school.trim()}
                  </span>
                ) : null}
                {user.preferredLanguage.trim() ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-800">
                    Lang: {user.preferredLanguage.trim()}
                  </span>
                ) : null}
                <span className="rounded-full border border-zinc-200 px-2 py-1 font-medium text-zinc-700">
                  {formatRole(user.roleLabel)}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div className="min-w-0 flex-1">
                  <ProfileConnectionsPanel
                    username={user.username}
                    followersCount={followers}
                    followingCount={following}
                    currentUsername={me?.username ?? null}
                  />
                </div>
                <div className="shrink-0 rounded-xl border border-zinc-200 p-2 text-center sm:w-[5.5rem] sm:py-3">
                  <div className="text-sm font-semibold text-zinc-900">
                    {gradedAgg._count._all > 0 ? gradedAgg._avg.aiScore?.toFixed(1) ?? "—" : "—"}
                  </div>
                  <div className="text-xs text-zinc-600">Avg (graded)</div>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 text-sm text-zinc-700">
                Total submissions:{" "}
                <span className="font-semibold text-zinc-900">{allSubmissionsAgg._count._all}</span>
                {gradedAgg._count._all > 0 ? (
                  <span className="text-zinc-500"> · {gradedAgg._count._all} graded</span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:col-span-2">
          {user.roleLabel === UserRole.TEACHER ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-zinc-900">
                  {isOwnProfile ? "Your problems" : "Published problems"}
                </div>
                <div className="text-sm text-zinc-600">
                  {isOwnProfile
                    ? "Drafts stay private; published items appear here and in the public problem list."
                    : "Problems authored by this teacher on Maphy."}
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {authoredProblems.length === 0 ? (
                  <div className="text-sm text-zinc-500">No problems yet.</div>
                ) : (
                  authoredProblems.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        {p.status === ProblemStatus.PUBLISHED ? (
                          <Link
                            className="text-sm font-medium text-zinc-900 hover:text-[color:var(--accent)]"
                            href={`/problems/${p.id}`}
                          >
                            {p.title}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-zinc-800">{p.title}</span>
                        )}
                        <div className="text-xs text-zinc-600">
                          {p.subject === "MATH" ? "Math" : "Physics"} · {p.year} · Class {p.class} ·{" "}
                          {p.phase.toLowerCase()}
                          {p.status === ProblemStatus.DRAFT ? (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-950">
                              Draft
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {isOwnProfile && p.status === ProblemStatus.DRAFT ? (
                        <Link
                          className="shrink-0 text-xs font-medium text-[color:var(--accent)] hover:underline"
                          href={`/teacher/problems/${p.id}/edit`}
                        >
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
          {user.roleLabel === UserRole.TEACHER ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-zinc-900">Contest sets</div>
                <div className="text-sm text-zinc-600">Olympiad sheets published by this teacher.</div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {authoredContestSets.length === 0 ? (
                  <div className="text-sm text-zinc-500">No contest sets yet.</div>
                ) : (
                  authoredContestSets.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2">
                      <div className="min-w-0">
                        {s.status === ProblemStatus.PUBLISHED ? (
                          <Link className="text-sm font-medium text-zinc-900 hover:text-[color:var(--accent)]" href={`/contest-sets/${s.id}`}>
                            {s.title}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-zinc-800">{s.title}</span>
                        )}
                        <div className="text-xs text-zinc-600">
                          {s.subject === "MATH" ? "Math" : "Physics"} · {s.year} · {s.stage.toLowerCase().replaceAll("_", " ")} · {s.totalProblemCount} problems
                        </div>
                      </div>
                      {isOwnProfile && s.status === ProblemStatus.DRAFT ? (
                        <Link className="text-xs font-medium text-[color:var(--accent)] hover:underline" href={`/teacher/contest-sets/${s.id}/edit`}>
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <div className="text-sm font-medium text-zinc-900">Submissions</div>
              <div className="text-sm text-zinc-600">Explore submissions by filters and sorting.</div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ProfileSubmissionsList
                username={user.username}
                initialRows={serializeProfileSubmissionsForClient(
                  submissions.filter((s) => Boolean(s.problem)) as any,
                  user.username,
                )}
                initialStats={{
                  totalSubmissions: allSubmissionsAgg._count._all,
                  avgScore: gradedAgg._count._all > 0 ? gradedAgg._avg.aiScore : null,
                  latestActivityAt: submissions[0]?.createdAt?.toISOString?.() ?? null,
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
