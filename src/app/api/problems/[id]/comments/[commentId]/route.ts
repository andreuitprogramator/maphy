import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { containsProfanity, normalizeCommentBody } from "@/lib/comments";
import { COMMENT_IMAGE_MAX_BYTES, isAllowedCommentImageMime } from "@/lib/comments/images";
import { storage } from "@/lib/storage/driver";
import {
  commentRowToApiNode,
  type CommentRowFromDb,
  loadReactionMap,
} from "@/lib/comments/thread-api";

const MAX_COMMENT_LEN = 2000;

async function readPatchPayload(req: Request): Promise<{
  textRaw: string | undefined;
  containsSpoiler: boolean | undefined;
  removeImage: boolean;
  imageFile: File | null;
}> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const raw = await req.json().catch(() => null);
    return {
      textRaw: raw?.body !== undefined ? String(raw.body) : undefined,
      containsSpoiler: raw?.containsSpoiler !== undefined ? Boolean(raw.containsSpoiler) : undefined,
      removeImage: Boolean(raw?.removeImage),
      imageFile: null,
    };
  }
  const form = await req.formData().catch(() => null);
  if (!form) {
    return { textRaw: undefined, containsSpoiler: undefined, removeImage: false, imageFile: null };
  }
  const bodyField = form.get("body");
  const f = form.get("image");
  return {
    textRaw: bodyField != null ? String(bodyField) : undefined,
    containsSpoiler:
      form.has("containsSpoiler") && (form.get("containsSpoiler") === "true" || form.get("containsSpoiler") === "on")
        ? true
        : form.has("containsSpoiler") && form.get("containsSpoiler") === "false"
          ? false
          : undefined,
    removeImage: form.get("removeImage") === "true",
    imageFile: f instanceof File && f.size > 0 ? f : null,
  };
}

function validateImageFile(file: File): string | null {
  if (!isAllowedCommentImageMime(file.type)) return "Image must be JPEG, PNG, WebP, or GIF.";
  if (file.size > COMMENT_IMAGE_MAX_BYTES) return "Image too large (max 3MB).";
  return null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");
  const { id, commentId } = await ctx.params;

  const rl = rateLimit({ key: `comment-edit:${me.id}`, limit: 30, windowMs: 60_000 });
  if (!rl.ok) return jsonError(429, "Too many edits", { retryAfterMs: rl.retryAfterMs });

  const row = await prisma.comment.findFirst({
    where: { id: commentId, problemId: id },
    select: {
      id: true,
      userId: true,
      problemId: true,
      parentCommentId: true,
      body: true,
      imageUrl: true,
      containsSpoiler: true,
      editedAt: true,
      createdAt: true,
      user: { select: { username: true, avatarUrl: true, roleLabel: true } },
    },
  });
  if (!row) return jsonError(404, "Comment not found");
  if (row.userId !== me.id) return jsonError(403, "You can edit only your own comments");

  const payload = await readPatchPayload(req);

  let nextBody = row.body;
  if (payload.textRaw !== undefined) {
    nextBody = normalizeCommentBody(payload.textRaw);
  }

  let nextSpoiler = row.containsSpoiler;
  if (payload.containsSpoiler !== undefined) {
    nextSpoiler = payload.containsSpoiler;
  }

  let nextImage = row.imageUrl;
  if (payload.removeImage) {
    nextImage = null;
  }
  if (payload.imageFile) {
    const imgErr = validateImageFile(payload.imageFile);
    if (imgErr) return jsonError(400, imgErr);
    const bytes = new Uint8Array(await payload.imageFile.arrayBuffer());
    const stored = await storage.saveImage({
      bytes,
      filename: payload.imageFile.name || "comment.jpg",
      folder: `comments/${me.id}/${id}`,
    });
    nextImage = stored.publicUrl;
  }

  const textFinal = normalizeCommentBody(nextBody);
  if (!textFinal && !nextImage) return jsonError(400, "Comment cannot be empty");

  if (textFinal.length > MAX_COMMENT_LEN) return jsonError(400, `Comment too long (max ${MAX_COMMENT_LEN} chars)`);
  if (textFinal && containsProfanity(textFinal)) return jsonError(400, "Comment rejected: please avoid abusive language.");

  const changedText = textFinal !== normalizeCommentBody(row.body);
  const changedSpoiler = nextSpoiler !== row.containsSpoiler;
  const changedImage = nextImage !== row.imageUrl;
  if (!changedText && !changedSpoiler && !changedImage) {
    const problem = await prisma.problem.findUnique({ where: { id }, select: { createdById: true } });
    const parentRow = row.parentCommentId
      ? await prisma.comment.findFirst({
          where: { id: row.parentCommentId, problemId: id },
          select: {
            id: true,
            userId: true,
            problemId: true,
            parentCommentId: true,
            body: true,
            imageUrl: true,
            containsSpoiler: true,
            editedAt: true,
            createdAt: true,
            user: { select: { username: true, avatarUrl: true, roleLabel: true } },
          },
        })
      : null;
    const solved100 = Boolean(
      await prisma.submission.findFirst({
        where: { userId: me.id, problemId: id, status: "GRADED", aiScore: 100 },
        select: { id: true },
      }),
    );
    const perfectSet = new Set<string>();
    if (solved100) perfectSet.add(me.id);
    const reactionMap = await loadReactionMap([row.id], me.id);
    const comment = commentRowToApiNode(row as CommentRowFromDb, {
      reactionMap,
      authorId: problem?.createdById ?? null,
      perfectSet,
      parentRow: parentRow as CommentRowFromDb | null,
    });
    return jsonOk({ comment });
  }

  const updated = await prisma.comment.update({
    where: { id: row.id },
    data: {
      body: textFinal,
      containsSpoiler: nextSpoiler,
      imageUrl: nextImage,
      editedAt: new Date(),
    },
    select: {
      id: true,
      userId: true,
      problemId: true,
      parentCommentId: true,
      body: true,
      imageUrl: true,
      containsSpoiler: true,
      editedAt: true,
      createdAt: true,
      user: { select: { username: true, avatarUrl: true, roleLabel: true } },
    },
  });

  const problem = await prisma.problem.findUnique({ where: { id }, select: { createdById: true } });
  const parentRow = updated.parentCommentId
    ? await prisma.comment.findFirst({
        where: { id: updated.parentCommentId, problemId: id },
        select: {
          id: true,
          userId: true,
          problemId: true,
          parentCommentId: true,
          body: true,
          imageUrl: true,
          containsSpoiler: true,
          editedAt: true,
          createdAt: true,
          user: { select: { username: true, avatarUrl: true, roleLabel: true } },
        },
      })
    : null;

  const solved100 = Boolean(
    await prisma.submission.findFirst({
      where: { userId: me.id, problemId: id, status: "GRADED", aiScore: 100 },
      select: { id: true },
    }),
  );
  const perfectSet = new Set<string>();
  if (solved100) perfectSet.add(me.id);

  const reactionMap = await loadReactionMap([updated.id], me.id);
  const comment = commentRowToApiNode(updated as CommentRowFromDb, {
    reactionMap,
    authorId: problem?.createdById ?? null,
    perfectSet,
    parentRow: parentRow as CommentRowFromDb | null,
  });

  return jsonOk({ comment });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");
  const { id, commentId } = await ctx.params;

  const row = await prisma.comment.findFirst({
    where: { id: commentId, problemId: id },
    select: { id: true, userId: true },
  });
  if (!row) return jsonError(404, "Comment not found");
  if (row.userId !== me.id) return jsonError(403, "You can delete only your own comments");

  await prisma.comment.delete({ where: { id: row.id } });
  return jsonOk({ ok: true });
}
