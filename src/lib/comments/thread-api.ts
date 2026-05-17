import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ProblemCommentTreeNode } from "@/lib/comments/comment-types";

/** Allowed comment depth levels: 0 (root) .. MAX_COMMENT_THREAD_DEPTH - 1 */
export const MAX_COMMENT_THREAD_DEPTH = 5;

export type CommentRowFromDb = {
  id: string;
  userId: string;
  problemId: string;
  parentCommentId: string | null;
  body: string;
  imageUrl: string | null;
  containsSpoiler: boolean;
  editedAt: Date | null;
  createdAt: Date;
  user: { username: string; avatarUrl: string | null; roleLabel: UserRole };
};

export type ReactionAgg = { likes: number; dislikes: number; mine: "LIKE" | "DISLIKE" | null };

type ParentLink = { id: string; parentCommentId: string | null };

export async function resolveReplyParentId(
  problemId: string,
  requestedParentId: string,
): Promise<string | null> {
  const chain: ParentLink[] = [];
  let cur: ParentLink | null = await prisma.comment.findFirst({
    where: { id: requestedParentId, problemId },
    select: { id: true, parentCommentId: true },
  });
  if (!cur) return null;
  let guard = 0;
  while (cur && guard++ < 32) {
    chain.push(cur);
    if (!cur.parentCommentId) break;
    cur = await prisma.comment.findFirst({
      where: { id: cur.parentCommentId, problemId },
      select: { id: true, parentCommentId: true },
    });
  }
  const parentLevel = chain.length - 1;
  if (parentLevel <= MAX_COMMENT_THREAD_DEPTH - 2) return requestedParentId;
  const idx = chain.length - (MAX_COMMENT_THREAD_DEPTH - 1);
  if (idx < 0 || idx >= chain.length) return requestedParentId;
  return chain[idx]!.id;
}

export async function loadReactionMap(commentIds: string[], viewerId: string | null): Promise<Map<string, ReactionAgg>> {
  const map = new Map<string, ReactionAgg>();
  for (const id of commentIds) {
    map.set(id, { likes: 0, dislikes: 0, mine: null });
  }
  if (commentIds.length === 0) return map;
  const rows = await prisma.commentReaction.findMany({
    where: { commentId: { in: commentIds } },
    select: { commentId: true, userId: true, type: true },
  });
  for (const r of rows) {
    const entry = map.get(r.commentId);
    if (!entry) continue;
    if (r.type === "LIKE") entry.likes += 1;
    else entry.dislikes += 1;
    if (viewerId && r.userId === viewerId) entry.mine = r.type;
  }
  return map;
}

export function buildCommentTree(
  rows: CommentRowFromDb[],
  reactionMap: Map<string, ReactionAgg>,
  authorId: string | null,
  perfectSet: Set<string>,
): ProblemCommentTreeNode[] {
  const byParent = new Map<string | null, CommentRowFromDb[]>();
  for (const r of rows) {
    const k = r.parentCommentId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(r);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  const rowById = new Map(rows.map((r) => [r.id, r]));

  function nodeFor(r: CommentRowFromDb): ProblemCommentTreeNode {
    const children = byParent.get(r.id) ?? [];
    const rx = reactionMap.get(r.id) ?? { likes: 0, dislikes: 0, mine: null };
    let replyTo: ProblemCommentTreeNode["replyTo"] = null;
    if (r.parentCommentId) {
      const p = rowById.get(r.parentCommentId);
      if (p) replyTo = { id: p.id, username: p.user.username };
    }
    return {
      id: r.id,
      body: r.body,
      imageUrl: r.imageUrl,
      containsSpoiler: r.containsSpoiler,
      createdAt: r.createdAt.toISOString(),
      editedAt: r.editedAt ? r.editedAt.toISOString() : null,
      parentCommentId: r.parentCommentId,
      replyTo,
      user: r.user,
      badges: {
        isTeacher: r.user.roleLabel === "TEACHER",
        isAuthor: authorId != null && authorId === r.userId,
        solved100: perfectSet.has(r.userId),
      },
      likes: rx.likes,
      dislikes: rx.dislikes,
      myReaction: rx.mine,
      directReplyCount: children.length,
      replies: children.map(nodeFor),
    };
  }

  return (byParent.get(null) ?? []).map(nodeFor);
}

const commentSelect: Prisma.CommentSelect = {
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
};

export async function fetchProblemCommentsTree(problemId: string, viewerId: string | null) {
  if (!problemId) {
    return { tree: [], totalCount: 0 };
  }

  const rows = await prisma.comment.findMany({
    where: { problemId },
    orderBy: [{ createdAt: "asc" }],
    select: commentSelect,
  });
  const uids = [...new Set(rows.map((r) => r.userId))];
  const perfectRows =
    uids.length === 0
      ? []
      : await prisma.submission.findMany({
          where: { problemId, status: "GRADED", aiScore: 100, userId: { in: uids } },
          distinct: ["userId"],
          select: { userId: true },
        });
  const perfectSet = new Set(perfectRows.map((p) => p.userId));
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { createdById: true },
  });
  const reactionMap = await loadReactionMap(
    rows.map((r) => r.id),
    viewerId,
  );
  const tree = buildCommentTree(rows as CommentRowFromDb[], reactionMap, problem?.createdById ?? null, perfectSet);
  return { tree, totalCount: rows.length };
}

export function commentRowToApiNode(
  row: CommentRowFromDb,
  opts: {
    reactionMap: Map<string, ReactionAgg>;
    authorId: string | null;
    perfectSet: Set<string>;
    parentRow: CommentRowFromDb | null;
  },
): ProblemCommentTreeNode {
  const rx = opts.reactionMap.get(row.id) ?? { likes: 0, dislikes: 0, mine: null };
  const replyTo =
    opts.parentRow != null ? { id: opts.parentRow.id, username: opts.parentRow.user.username } : null;
  return {
    id: row.id,
    body: row.body,
    imageUrl: row.imageUrl,
    containsSpoiler: row.containsSpoiler,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    parentCommentId: row.parentCommentId,
    replyTo,
    user: row.user,
    badges: {
      isTeacher: row.user.roleLabel === "TEACHER",
      isAuthor: opts.authorId != null && opts.authorId === row.userId,
      solved100: opts.perfectSet.has(row.userId),
    },
    likes: rx.likes,
    dislikes: rx.dislikes,
    myReaction: rx.mine,
    directReplyCount: 0,
    replies: [],
  };
}
