import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FollowButton } from "@/components/profile/follow-button";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const me = await getSessionUser();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, bio: true, imageUrl: true, createdAt: true },
  });
  if (!user) return notFound();

  const [submissions, agg, followers, following, isFollowing] = await Promise.all([
    prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        score: true,
        createdAt: true,
        imageUrl: true,
        problem: { select: { id: true, title: true } },
      },
    }),
    prisma.submission.aggregate({
      where: { userId: user.id },
      _count: { _all: true },
      _avg: { score: true },
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
  ]);

  return (
    <Container className="py-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                  {user.imageUrl ? (
                    <Image src={user.imageUrl} alt="Profile picture" fill className="object-cover" sizes="48px" />
                  ) : null}
                </div>
                <div>
                  <div className="text-lg font-semibold tracking-tight">@{user.username}</div>
                  <div className="text-xs text-zinc-500">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {me && me.id !== user.id ? (
                <FollowButton username={user.username} initialFollowing={isFollowing} />
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="text-sm text-zinc-700 whitespace-pre-wrap">{user.bio || "No bio yet."}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-zinc-200 p-2">
                  <div className="text-sm font-semibold">{followers}</div>
                  <div className="text-xs text-zinc-600">Followers</div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2">
                  <div className="text-sm font-semibold">{following}</div>
                  <div className="text-xs text-zinc-600">Following</div>
                </div>
                <div className="rounded-xl border border-zinc-200 p-2">
                  <div className="text-sm font-semibold">{agg._avg.score?.toFixed(1) ?? "—"}</div>
                  <div className="text-xs text-zinc-600">Avg score</div>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 text-sm text-zinc-700">
                Total submissions: <span className="font-semibold text-zinc-900">{agg._count._all}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="text-sm font-medium text-zinc-900">Submissions</div>
              <div className="text-sm text-zinc-600">Latest 50.</div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {submissions.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-600">No submissions yet.</div>
              ) : (
                submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3">
                    <div className="min-w-0">
                      <Link className="text-sm font-medium text-zinc-900 hover:underline" href={`/problems/${s.problem.id}`}>
                        {s.problem.title}
                      </Link>
                      <div className="text-xs text-zinc-600">{new Date(s.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold">{s.score}</div>
                      <a href={s.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-[color:var(--accent)] hover:underline">
                        image
                      </a>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}

