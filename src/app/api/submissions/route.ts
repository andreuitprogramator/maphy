import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { storage } from "@/lib/storage/driver";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const problemId = url.searchParams.get("problemId");
  if (!problemId) return jsonError(400, "Missing problemId");

  const submissions = await prisma.submission.findMany({
    where: { problemId },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      score: true,
      createdAt: true,
      imageUrl: true,
      user: { select: { id: true, username: true, imageUrl: true } },
    },
  });

  return jsonOk({ submissions });
}

const CreateSchema = z.object({
  problemId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return jsonError(401, "Not authenticated");

  const rl = rateLimit({ key: `submissions:${user.id}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Too many submissions", { retryAfterMs: rl.retryAfterMs });

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Invalid form data");

  const parsed = CreateSchema.safeParse({ problemId: form.get("problemId") });
  if (!parsed.success) return jsonError(400, "Invalid input", { issues: parsed.error.issues });

  const file = form.get("image");
  if (!(file instanceof File)) return jsonError(400, "Missing image");
  if (!file.type.startsWith("image/")) return jsonError(400, "File must be an image");
  if (file.size > 8 * 1024 * 1024) return jsonError(400, "Image too large (max 8MB)");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storage.saveImage({
    bytes,
    filename: file.name || "solution.jpg",
    folder: `solutions/${user.id}/${parsed.data.problemId}`,
  });

  const score = Math.floor(Math.random() * 101);

  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      problemId: parsed.data.problemId,
      imageUrl: stored.publicUrl,
      score,
    },
    select: {
      id: true,
      score: true,
      createdAt: true,
      imageUrl: true,
      user: { select: { id: true, username: true, imageUrl: true } },
    },
  });

  return jsonOk({ submission }, { status: 201 });
}

