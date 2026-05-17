import { after } from "next/server";
import { z } from "zod";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/storage/driver";
import { gradeSubmission } from "@/lib/grading/service";
import { PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE } from "@/lib/problems/submission-display";
import { notifyFollowersOfSubmission } from "@/lib/notifications/service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const problemId = url.searchParams.get("problemId");
  const contestSetProblemId = url.searchParams.get("contestSetProblemId");
  const scope = url.searchParams.get("scope");
  if (!problemId && !contestSetProblemId) return jsonError(400, "Missing problemId or contestSetProblemId");

  const me = await requireUser();

  const targetWhere = {
    ...(problemId ? { problemId } : {}),
    ...(contestSetProblemId ? { contestSetProblemId } : {}),
  };

  if (scope === "mine") {
    if (!me) return jsonError(401, "Not authenticated");
    const submissions = await prisma.submission.findMany({
      where: { ...targetWhere, userId: me.id },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        aiScore: true,
        aiFeedback: true,
        aiBreakdown: true,
        imageQualityReason: true,
        reviewedAt: true,
        createdAt: true,
        imageUrl: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    return jsonOk({ submissions });
  }

  const viewerUnlockedPeerImages = me
    ? Boolean(
        await prisma.submission.findFirst({
          where: {
            userId: me.id,
            ...targetWhere,
            status: "GRADED",
            aiScore: { gte: PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE },
          },
          select: { id: true },
        }),
      )
    : false;

  const allRows = await prisma.submission.findMany({
    where: targetWhere,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      status: true,
      aiScore: true,
      aiFeedback: true,
      aiBreakdown: true,
      imageQualityReason: true,
      reviewedAt: true,
      createdAt: true,
      imageUrl: true,
      userId: true,
      user: { select: { username: true, avatarUrl: true } },
    },
  });

  const submissions = allRows.map((row) => {
    const isOwn = me?.id === row.userId;
    const canViewImage = isOwn || viewerUnlockedPeerImages;
    return {
      id: row.id,
      status: row.status,
      aiScore: row.aiScore,
      aiFeedback: row.aiFeedback,
      aiBreakdown: row.aiBreakdown,
      imageQualityReason: row.imageQualityReason,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      imageUrl: canViewImage ? row.imageUrl : null,
      canViewImage,
      user: row.user,
    };
  });

  return jsonOk({
    submissions,
    viewerUnlockedPeerImages,
    unlockHint: viewerUnlockedPeerImages
      ? null
      : `Score at least ${PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE}/100 on this problem to unlock other users' solution images.`,
  });
}

const CreateSchema = z
  .object({
    problemId: z.string().min(1).optional(),
    contestSetProblemId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.problemId || v.contestSetProblemId), {
    message: "problemId or contestSetProblemId is required",
  });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Not authenticated");

  const rl = rateLimit({ key: `submissions:${user.id}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Too many submissions", { retryAfterMs: rl.retryAfterMs });

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Invalid form data");

  const problemIdRaw = form.get("problemId");
  const contestSetProblemIdRaw = form.get("contestSetProblemId");
  const parsed = CreateSchema.safeParse({
    problemId: typeof problemIdRaw === "string" ? problemIdRaw : undefined,
    contestSetProblemId: typeof contestSetProblemIdRaw === "string" ? contestSetProblemIdRaw : undefined,
  });
  if (!parsed.success) return jsonError(400, "Invalid input", { issues: parsed.error.issues });

  const targetProblemId = parsed.data.problemId ?? null;
  const targetContestSetProblemId = parsed.data.contestSetProblemId ?? null;

  let problem: { id: string; status: ProblemStatus; title: string } | null = null;
  if (targetProblemId) {
    problem = await prisma.problem.findUnique({
      where: { id: targetProblemId },
      select: { id: true, status: true, title: true },
    });
    if (!problem) return jsonError(404, "Problem not found");
    if (problem.status !== ProblemStatus.PUBLISHED) {
      return jsonError(403, "Submissions are only accepted for published problems.");
    }
  }

  if (targetContestSetProblemId) {
    const contestSetProblem = await prisma.contestSetProblem.findUnique({
      where: { id: targetContestSetProblemId },
      select: { id: true, contestSet: { select: { status: true } } },
    });
    if (!contestSetProblem) return jsonError(404, "Contest set problem not found");
    if (contestSetProblem.contestSet.status !== ProblemStatus.PUBLISHED) {
      return jsonError(403, "Submissions are only accepted for published contest sets.");
    }
  }

  const file = form.get("image");
  if (!(file instanceof File)) return jsonError(400, "Missing image");
  if (!file.type.startsWith("image/")) return jsonError(400, "File must be an image");
  if (file.size > 8 * 1024 * 1024) return jsonError(400, "Image too large (max 8MB)");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storage.saveImage({
    bytes,
    filename: file.name || "solution.jpg",
    folder: `solutions/${user.id}/${targetProblemId ?? targetContestSetProblemId ?? "unknown"}`,
  });

  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      problemId: targetProblemId,
      contestSetProblemId: targetContestSetProblemId,
      imageUrl: stored.publicUrl,
      status: "PENDING",
    },
    select: {
      id: true,
      status: true,
      aiScore: true,
      aiFeedback: true,
      aiBreakdown: true,
      imageQualityReason: true,
      reviewedAt: true,
      createdAt: true,
      imageUrl: true,
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  if (problem) {
    await notifyFollowersOfSubmission({
      submissionId: submission.id,
      submitterId: user.id,
      submitterUsername: user.username,
      problemId: problem.id,
      problemTitle: problem.title,
    });
  }

  const submissionId = submission.id;
  after(async () => {
    try {
      await gradeSubmission(submissionId);
    } catch (err) {
      console.error("[submissions] background grading error:", err);
      try {
        await prisma.submission.update({
          where: { id: submissionId },
          data: { status: "FAILED", reviewedAt: new Date() },
        });
      } catch (e) {
        console.error("[submissions] failed to mark submission FAILED:", e);
      }
    }
  });

  return jsonOk({ submission }, { status: 201 });
}
