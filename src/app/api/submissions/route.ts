import { after } from "next/server";
import { z } from "zod";
import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/storage/driver";
import { gradeSubmissionSimple } from "@/lib/grading/service";
import { PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE } from "@/lib/problems/submission-display";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const problemId = url.searchParams.get("problemId");
  const contestSetProblemId = url.searchParams.get("contestSetProblemId");
  const scope = url.searchParams.get("scope");
  if (!problemId && !contestSetProblemId) return jsonError(400, "ID problemă sau set de concurs lipsește");

  const me = await requireUser();

  const targetWhere = {
    ...(problemId ? { problemId } : {}),
    ...(contestSetProblemId ? { contestSetProblemId } : {}),
  };

  if (scope === "mine") {
    if (!me) return jsonError(401, "Neautentificat");
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
        extraImageUrls: true,
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
      extraImageUrls: true,
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
      extraImageUrls: canViewImage ? row.extraImageUrls : null,
      canViewImage,
      user: row.user,
    };
  });

  return jsonOk({
    submissions,
    viewerUnlockedPeerImages,
    unlockHint: viewerUnlockedPeerImages
      ? null
      : `Obține cel puțin ${PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE}/100 la această problemă pentru a debloca imaginile celorlalți utilizatori.`,
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
  if (!user) return jsonError(401, "Neautentificat");

  const rl = rateLimit({ key: `submissions:${user.id}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Prea multe rezolvări trimise. Încearcă din nou mai târziu.", { retryAfterMs: rl.retryAfterMs });

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Date formular invalide");

  const problemIdRaw = form.get("problemId");
  const contestSetProblemIdRaw = form.get("contestSetProblemId");
  const parsed = CreateSchema.safeParse({
    problemId: typeof problemIdRaw === "string" ? problemIdRaw : undefined,
    contestSetProblemId: typeof contestSetProblemIdRaw === "string" ? contestSetProblemIdRaw : undefined,
  });
  if (!parsed.success) return jsonError(400, "Date invalide", { issues: parsed.error.issues });

  const targetProblemId = parsed.data.problemId ?? null;
  const targetContestSetProblemId = parsed.data.contestSetProblemId ?? null;

  let problem: { id: string; status: ProblemStatus; title: string } | null = null;
  if (targetProblemId) {
    problem = await prisma.problem.findUnique({
      where: { id: targetProblemId },
      select: { id: true, status: true, title: true },
    });
    if (!problem) return jsonError(404, "Problema nu a fost găsită");
    if (problem.status !== ProblemStatus.PUBLISHED) {
      return jsonError(403, "Rezolvările sunt acceptate doar pentru problemele publicate.");
    }
  }

  if (targetContestSetProblemId) {
    const contestSetProblem = await prisma.contestSetProblem.findUnique({
      where: { id: targetContestSetProblemId },
      select: { id: true, contestSet: { select: { status: true } } },
    });
    if (!contestSetProblem) return jsonError(404, "Problema din setul de concurs nu a fost găsită");
    if (contestSetProblem.contestSet.status !== ProblemStatus.PUBLISHED) {
      return jsonError(403, "Rezolvările sunt acceptate doar pentru seturile de concurs publicate.");
    }
  }

  const rawFiles = form.getAll("image");
  const files = rawFiles.filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError(400, "Imaginea lipsește");
  if (files.length > 5) return jsonError(400, "Maxim 5 imagini per rezolvare");
  for (const f of files) {
    if (!f.type.startsWith("image/")) return jsonError(400, "Toate fișierele trebuie să fie imagini");
    if (f.size > 8 * 1024 * 1024) return jsonError(400, "Fiecare imagine trebuie să fie sub 8MB");
  }

  const folder = `solutions/${user.id}/${targetProblemId ?? targetContestSetProblemId ?? "unknown"}`;
  const [primaryStored, ...extraStored] = await Promise.all(
    files.map(async (f, i) => {
      const buf = await f.arrayBuffer();
      return storage.saveImage({ bytes: new Uint8Array(buf), filename: f.name || `solution_${i}.jpg`, folder });
    })
  );

  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      problemId: targetProblemId,
      contestSetProblemId: targetContestSetProblemId,
      imageUrl: primaryStored!.publicUrl,
      extraImageUrls: extraStored.length > 0 ? JSON.stringify(extraStored.map((s) => s.publicUrl)) : null,
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
      extraImageUrls: true,
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  const submissionId = submission.id;
  after(async () => {
    try {
      await gradeSubmissionSimple(submissionId);
    } catch (err) {
      // Eroare neprinsă din gradeSubmissionSimple (ex. Prisma findUnique fail, eroare pre-try).
      const errName = err instanceof Error ? err.constructor.name : typeof err;
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? "") : "";
      console.error(
        `[submissions] background grading error — submissionId=${submissionId}`,
        {
          errorName: errName,
          errorMessage: errMessage,
          stack: errStack.split("\n").slice(0, 8).join("\n"),
        },
      );
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
