import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProblemStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfileSubmissionsToggle } from "@/components/profile/profile-submissions-toggle";
import { ActivityHeatmap } from "@/components/profile/activity-heatmap";
import { ProfileConnectionsPanel } from "@/components/social/profile-connections-panel";
import { serializeProfileSubmissionsForClient } from "@/lib/problems/submission-display";
import { usernameColorClass } from "@/lib/ui/username-color";

export const dynamic = "force-dynamic";

function formatRole(role: UserRole) {
  switch (role) {
    case UserRole.STUDENT:
      return "Elev";
    case UserRole.TEACHER:
      return "Profesor";
    case UserRole.OTHER:
      return "Altul";
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
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [submissions, allSubmissionsAgg, gradedAgg, solveRaw, followers, following, isFollowing, isFollowedBy, authoredContestSets] =
    await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id, OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }] },
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
        extraImageUrls: true,
        problem: { select: { id: true, title: true } },
        contestSetProblem: { select: { id: true, title: true, orderNumber: true, contestSetId: true } },
      },
    }),
    prisma.submission.aggregate({
      where: { userId: user.id, OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }] },
      _count: { _all: true },
    }),
    prisma.submission.aggregate({
      where: { userId: user.id, OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }], status: "GRADED", aiScore: { not: null } },
      _count: { _all: true },
      _avg: { aiScore: true },
    }),
    prisma.submission.findMany({
      where: { userId: user.id, status: "GRADED", aiScore: { gte: 70 }, OR: [{ problemId: { not: null } }, { contestSetProblemId: { not: null } }] },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        problemId: true,
        contestSetProblemId: true,
        aiScore: true,
        problem: { select: { subject: true } },
        contestSetProblem: { select: { contestSet: { select: { subject: true } } } },
      },
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

  // First time each problem crossed 70+ (ordered by createdAt asc, so first entry = first solve)
  type SolveSubject = "MATH" | "PHYSICS" | "CHEMISTRY" | null;
  const firstSolveByProblem = new Map<string, string>();
  const firstSolveSubject = new Map<string, SolveSubject>();
  for (const r of solveRaw) {
    const key = r.problemId ?? `cp:${r.contestSetProblemId}`;
    if (!firstSolveByProblem.has(key)) {
      firstSolveByProblem.set(key, r.createdAt.toISOString().slice(0, 10));
      const subj = (r.problem?.subject ?? r.contestSetProblem?.contestSet?.subject ?? null) as SolveSubject;
      firstSolveSubject.set(key, subj);
    }
  }

  let p70Math = 0, p70Physics = 0, p70Chemistry = 0;
  for (const subj of firstSolveSubject.values()) {
    if (subj === "MATH") p70Math++;
    else if (subj === "PHYSICS") p70Physics++;
    else if (subj === "CHEMISTRY") p70Chemistry++;
  }
  const firstSolveDates = Array.from(firstSolveByProblem.values());

  const perfectProblems = new Set<string>();
  for (const r of solveRaw) {
    if (r.aiScore === 100) perfectProblems.add(r.problemId ?? `cp:${r.contestSetProblemId}`);
  }

  // Heatmap: count first-solves per day (last year only)
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10);
  const activity: Record<string, number> = {};
  for (const dateStr of firstSolveDates) {
    if (dateStr >= oneYearAgoStr) activity[dateStr] = (activity[dateStr] ?? 0) + 1;
  }

  // Streak: consecutive days with at least one first-solve
  const daySet = new Set(firstSolveDates);
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  let currentStreak = 0;
  const anchorDay = daySet.has(todayStr) ? todayStr : daySet.has(yesterdayStr) ? yesterdayStr : null;
  if (anchorDay) {
    const cur = new Date(anchorDay);
    while (daySet.has(cur.toISOString().slice(0, 10))) {
      currentStreak++;
      cur.setDate(cur.getDate() - 1);
    }
  }

  const sortedDays = Array.from(daySet).sort();
  let bestStreak = sortedDays.length > 0 ? 1 : 0;
  let run = sortedDays.length > 0 ? 1 : 0;
  for (let i = 1; i < sortedDays.length; i++) {
    const diffMs = new Date(sortedDays[i]).getTime() - new Date(sortedDays[i - 1]).getTime();
    if (diffMs === 86_400_000) { run++; if (run > bestStreak) bestStreak = run; }
    else run = 1;
  }
  bestStreak = Math.max(bestStreak, currentStreak);

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
                  <div className={`text-lg font-semibold tracking-tight ${usernameColorClass(user.username)}`}>@{user.username}</div>
                  {displayName ? <div className="text-sm text-zinc-700">{displayName}</div> : null}
                  <div className="mt-1 text-xs text-zinc-500">
                    Înscris {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {me && !isOwnProfile ? (
                  <FollowButton username={user.username} initialFollowing={isFollowing} />
                ) : null}
                {isOwnProfile ? (
                  <Link
                    className="text-xs font-medium text-[color:var(--accent)] hover:underline"
                    href="/settings"
                  >
                    Editează profilul
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {user.bio.trim() ? (
                <div className="text-sm text-zinc-700 whitespace-pre-wrap">{user.bio}</div>
              ) : (
                <div className="text-sm italic text-zinc-400">Nicio descriere încă.</div>
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
                    Limbă: {user.preferredLanguage.trim()}
                  </span>
                ) : null}
                <span className="rounded-full border border-zinc-200 px-2 py-1 font-medium text-zinc-700">
                  {formatRole(user.roleLabel)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Row 1: 100p full width */}
                <div className="col-span-2 rounded-xl border border-zinc-200 p-2 text-center">
                  <div className="text-lg font-bold text-emerald-500">{perfectProblems.size}</div>
                  <div className="text-xs text-zinc-500">Probleme 100p</div>
                </div>
                {/* Row 2: 70+ total + per subject, 4 columns */}
                <div className="col-span-2 grid grid-cols-4 gap-2">
                  <div className="rounded-xl border border-zinc-200 p-2 text-center">
                    <div className="text-lg font-bold text-amber-500">{firstSolveByProblem.size}</div>
                    <div className="text-xs text-zinc-500">70p+ total</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-2 text-center">
                    <div className="text-lg font-bold text-violet-500">{p70Math}</div>
                    <div className="text-xs text-zinc-500">Mate</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-2 text-center">
                    <div className="text-lg font-bold text-sky-500">{p70Physics}</div>
                    <div className="text-xs text-zinc-500">Fizică</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-2 text-center">
                    <div className="text-lg font-bold text-green-500">{p70Chemistry}</div>
                    <div className="text-xs text-zinc-500">Chimie</div>
                  </div>
                </div>
                {/* Row 3: social */}
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <div className="text-lg font-bold text-zinc-800">{followers}</div>
                  <div className="text-xs text-zinc-500">Urmăritori</div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <div className="text-lg font-bold text-zinc-800">{following}</div>
                  <div className="text-xs text-zinc-500">Urmărește</div>
                </div>
                {/* Row 4: streak */}
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <div className="text-lg font-bold text-sky-500">{currentStreak}</div>
                  <div className="text-xs text-zinc-500">Streak</div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2 text-center">
                  <div className="text-lg font-bold text-sky-700">{bestStreak}</div>
                  <div className="text-xs text-zinc-500">Record streak</div>
                </div>
                {user.roleLabel === UserRole.TEACHER ? (
                  <div className="col-span-2 rounded-xl border border-zinc-200 p-2 text-center">
                    <div className="text-lg font-bold text-violet-500">{authoredContestSets.length}</div>
                    <div className="text-xs text-zinc-500">Subiecte publicate</div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:col-span-2">
          {user.roleLabel === UserRole.TEACHER ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-medium text-zinc-900">Seturi de concurs</div>
                <div className="text-sm text-zinc-600">Seturi de concurs publicate de acest profesor.</div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {authoredContestSets.length === 0 ? (
                  <div className="text-sm text-zinc-500">Niciun set de concurs încă.</div>
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
                          {s.subject === "MATH" ? "Matematică" : "Fizică"} · {s.year} · {s.stage.toLowerCase().replaceAll("_", " ")} · {s.totalProblemCount} probleme
                        </div>
                      </div>
                      {isOwnProfile && s.status === ProblemStatus.DRAFT ? (
                        <Link className="text-xs font-medium text-[color:var(--accent)] hover:underline" href={`/teacher/contest-sets/${s.id}/edit`}>
                          Editează
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
              <div className="text-sm font-medium text-zinc-900">Activitate</div>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap activity={activity} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-medium text-zinc-900">Rezolvări</div>
            </CardHeader>
            <CardContent>
              <ProfileSubmissionsToggle
                username={user.username}
                initialRows={serializeProfileSubmissionsForClient(
                  submissions
                    .filter((s) => Boolean(s.problem) || Boolean(s.contestSetProblem))
                    .map((s) => ({
                      ...s,
                      problem: s.problem ?? {
                        id: s.contestSetProblem!.contestSetId + "/" + s.contestSetProblem!.orderNumber,
                        title: `Problema ${s.contestSetProblem!.orderNumber} (concurs)`,
                      },
                    })) as any,
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
