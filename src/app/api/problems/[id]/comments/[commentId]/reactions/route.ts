import { CommentReactionType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { loadReactionMap } from "@/lib/comments/thread-api";

const BodySchema = z.object({
  value: z.enum(["like", "dislike", "none"]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Neautentificat");
  const { id, commentId } = await ctx.params;

  const rl = rateLimit({ key: `comment-react:${me.id}`, limit: 80, windowMs: 60_000 });
  if (!rl.ok) return jsonError(429, "Prea multe reacții", { retryAfterMs: rl.retryAfterMs });

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, "Corp invalid");

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, problemId: id },
    select: { id: true },
  });
  if (!comment) return jsonError(404, "Comentariul nu a fost găsit");

  const v = parsed.data.value;
  if (v === "none") {
    await prisma.commentReaction.deleteMany({ where: { commentId, userId: me.id } });
  } else {
    const type: CommentReactionType = v === "like" ? "LIKE" : "DISLIKE";
    await prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId: me.id } },
      create: { commentId, userId: me.id, type },
      update: { type },
    });
  }

  const map = await loadReactionMap([commentId], me.id);
  const agg = map.get(commentId)!;

  return jsonOk({
    likes: agg.likes,
    dislikes: agg.dislikes,
    myReaction: agg.mine,
  });
}
