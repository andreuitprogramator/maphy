import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { containsProfanity, normalizeCommentBody } from "@/lib/comments";
import { COMMENT_IMAGE_MAX_BYTES, isAllowedCommentImageMime } from "@/lib/comments/images";
import { storage } from "@/lib/storage/driver";
import {
  commentRowToApiNode,
  fetchProblemCommentsTree,
  resolveReplyParentId,
  type CommentRowFromDb,
  loadReactionMap,
} from "@/lib/comments/thread-api";

const MAX_COMMENT_LEN = 2000;

async function readCreatePayload(req: Request): Promise<{
  textRaw: string;
  containsSpoiler: boolean;
  parentCommentId: string | null;
  imageFile: File | null;
}> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const raw = await req.json().catch(() => null);
    const p =
      typeof raw?.parentCommentId === "string" && raw.parentCommentId.trim().length > 0
        ? raw.parentCommentId.trim()
        : null;
    return {
      textRaw: String(raw?.body ?? ""),
      containsSpoiler: Boolean(raw?.containsSpoiler),
      parentCommentId: p,
      imageFile: null,
    };
  }
  const form = await req.formData().catch(() => null);
  if (!form) {
    return { textRaw: "", containsSpoiler: false, parentCommentId: null, imageFile: null };
  }
  const p = String(form.get("parentCommentId") ?? "").trim() || null;
  const f = form.get("image");
  return {
    textRaw: String(form.get("body") ?? ""),
    containsSpoiler: form.get("containsSpoiler") === "true" || form.get("containsSpoiler") === "on",
    parentCommentId: p,
    imageFile: f instanceof File && f.size > 0 ? f : null,
  };
}

function validateImageFile(file: File): string | null {
  if (!isAllowedCommentImageMime(file.type)) return "Image must be JPEG, PNG, WebP, or GIF.";
  if (file.size > COMMENT_IMAGE_MAX_BYTES) return "Image too large (max 3MB).";
  return null;
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const me = await requireUser();
  const problem = await prisma.problem.findUnique({ where: { id }, select: { id: true } });
  if (!problem) return jsonError(404, "Problem not found");

  const { tree, totalCount } = await fetchProblemCommentsTree(id, me?.id ?? null);
  return jsonOk({ comments: tree, totalCount });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    if (!me) return jsonError(401, "Not authenticated");
    const { id } = await ctx.params;

    const rl = rateLimit({ key: `comments:${me.id}:${id}`, limit: 8, windowMs: 60_000 });
    if (!rl.ok) return jsonError(429, "Too many comments", { retryAfterMs: rl.retryAfterMs });

    const payload = await readCreatePayload(req);
    const text = normalizeCommentBody(payload.textRaw);

    let parentId: string | null = payload.parentCommentId;
    if (parentId) {
      const resolved = await resolveReplyParentId(id, parentId);
      if (!resolved) return jsonError(400, "Invalid parent comment");
      parentId = resolved;
    }

    let imageUrl: string | null = null;
    if (payload.imageFile) {
      const imgErr = validateImageFile(payload.imageFile);
      if (imgErr) return jsonError(400, imgErr);
      const bytes = new Uint8Array(await payload.imageFile.arrayBuffer());
      const stored = await storage.saveImage({
        bytes,
        filename: payload.imageFile.name || "comment.jpg",
        folder: `comments/${me.id}/${id}`,
      });
      imageUrl = stored.publicUrl;
    }

    if (!text && !imageUrl) return jsonError(400, "Add text or an image.");
    if (text.length > MAX_COMMENT_LEN) return jsonError(400, `Comment too long (max ${MAX_COMMENT_LEN} chars)`);
    if (text && containsProfanity(text)) return jsonError(400, "Comment rejected: please avoid abusive language.");

    const problem = await prisma.problem.findUnique({ where: { id }, select: { id: true, status: true, createdById: true } });
    if (!problem) return jsonError(404, "Problem not found");
    if (problem.status !== "PUBLISHED") return jsonError(403, "Comments are enabled only for published problems");

    const created = await prisma.comment.create({
      data: {
        userId: me.id,
        problemId: id,
        parentCommentId: parentId,
        body: text,
        imageUrl,
        containsSpoiler: payload.containsSpoiler,
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

    const parentRow = parentId
      ? await prisma.comment.findFirst({
          where: { id: parentId, problemId: id },
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

    const reactionMap = await loadReactionMap([created.id], me.id);
    const row = created as CommentRowFromDb;
    const parentForApi = parentRow as CommentRowFromDb | null;
    const comment = commentRowToApiNode(row, {
      reactionMap,
      authorId: problem.createdById,
      perfectSet,
      parentRow: parentForApi,
    });

    return jsonOk({ comment }, { status: 201 });
  } catch (err) {
    console.error("[comments POST]", err);
    return jsonError(500, err instanceof Error ? err.message : "Could not create comment");
  }
}
