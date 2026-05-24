"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { ProblemCommentTreeNode } from "@/lib/comments/comment-types";
import { usernameColorClass } from "@/lib/ui/username-color";

function updateCommentInTree(
  list: ProblemCommentTreeNode[],
  id: string,
  updater: (n: ProblemCommentTreeNode) => ProblemCommentTreeNode,
): ProblemCommentTreeNode[] {
  return list.map((n) => {
    if (n.id === id) return updater(n);
    if (n.replies.length === 0) return n;
    return { ...n, replies: updateCommentInTree(n.replies, id, updater) };
  });
}

function CommentComposer({
  problemId,
  parentId,
  replyHintUsername,
  onCancel,
  onPosted,
  submitLabel,
}: {
  problemId: string;
  parentId: string | null;
  replyHintUsername: string | null;
  onCancel?: () => void;
  onPosted: () => void;
  submitLabel: string;
}) {
  const [body, setBody] = React.useState("");
  const [containsSpoiler, setContainsSpoiler] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const url = `/api/problems/${problemId}/comments`;
    const fetchOpts: RequestInit = { method: "POST", credentials: "include" };
    if (file) {
      const fd = new FormData();
      fd.append("body", body);
      fd.append("containsSpoiler", containsSpoiler ? "true" : "false");
      if (parentId) fd.append("parentCommentId", parentId);
      fd.append("image", file);
      fetchOpts.body = fd;
    } else {
      fetchOpts.headers = { "content-type": "application/json" };
      fetchOpts.body = JSON.stringify({
        body,
        containsSpoiler,
        ...(parentId ? { parentCommentId: parentId } : {}),
      });
    }
    const res = await fetch(url, fetchOpts);
    const raw = await res.text();
    let data: { error?: string } = {};
    try {
      data = raw ? (JSON.parse(raw) as { error?: string }) : {};
    } catch {
      data = { error: raw.slice(0, 240) || `Server error (${res.status})` };
    }
    setPending(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : `Could not post (${res.status})`);
      return;
    }
    setBody("");
    setContainsSpoiler(false);
    setFile(null);
    onCancel?.();
    onPosted();
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
      {replyHintUsername ? (
        <div className="text-xs font-medium text-zinc-700">
          Răspuns la <span className="text-[color:var(--accent)]">@{replyHintUsername}</span>
        </div>
      ) : null}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={parentId ? "Scrie un răspuns…" : "Scrie un comentariu…"}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1">
          <span>Imagine</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? <span className="truncate text-zinc-700">{file.name}</span> : null}
      </div>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="max-h-40 max-w-full rounded-lg border border-zinc-200 object-contain" />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={containsSpoiler}
            onChange={(e) => setContainsSpoiler(e.target.checked)}
          />
          Conține spoilere
        </label>
        <div className="flex flex-wrap gap-2">
          {onCancel ? (
            <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
              Anulează
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Se postează…" : submitLabel}
          </Button>
        </div>
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </form>
  );
}

export function ProblemCommentsSection({
  problemId,
  currentUserId,
  currentUsername,
  initialComments,
  initialTotalCount,
}: {
  problemId: string;
  currentUserId: string | null;
  currentUsername: string | null;
  initialComments: ProblemCommentTreeNode[];
  initialTotalCount: number;
}) {
  const [comments, setComments] = React.useState<ProblemCommentTreeNode[]>(initialComments);
  const [totalCount, setTotalCount] = React.useState(initialTotalCount);
  const [openSpoilers, setOpenSpoilers] = React.useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = React.useState<{ id: string; username: string } | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  React.useEffect(() => {
    setTotalCount(initialTotalCount);
  }, [initialTotalCount]);

  async function refresh() {
    const res = await fetch(`/api/problems/${problemId}/comments`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setComments((data.comments ?? []) as ProblemCommentTreeNode[]);
    if (typeof data.totalCount === "number") setTotalCount(data.totalCount);
  }

  async function remove(commentId: string) {
    const res = await fetch(`/api/problems/${problemId}/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return;
    await refresh();
  }

  async function sendReaction(commentId: string, value: "like" | "dislike" | "none") {
    const res = await fetch(`/api/problems/${problemId}/comments/${commentId}/reactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { likes: number; dislikes: number; myReaction: "LIKE" | "DISLIKE" | null };
    setComments((prev) =>
      updateCommentInTree(prev, commentId, (n) => ({
        ...n,
        likes: data.likes,
        dislikes: data.dislikes,
        myReaction: data.myReaction,
      })),
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-zinc-900">Discuție</div>
          <div className="text-xs text-zinc-600">
            {totalCount} {totalCount === 1 ? "comentariu" : "comentarii"} · Evitați să postați soluții complete aici.
            <span className="mt-0.5 block text-zinc-500">
              Poți răspunde și aprecia/dezaprecia propriile comentarii dacă vrei.
            </span>
          </div>
        </div>
      </div>

      {currentUserId ? (
        <CommentComposer
          problemId={problemId}
          parentId={null}
          replyHintUsername={null}
          onPosted={refresh}
          submitLabel="Postează comentariu"
        />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          <Link href="/login" className="font-medium text-[color:var(--accent)] hover:underline">
            Autentifică-te
          </Link>{" "}
          pentru a participa la discuție.
        </div>
      )}

      <div className="grid gap-2">
        {comments.length === 0 ? <div className="text-sm text-zinc-600">Niciun comentariu încă.</div> : null}
        {comments.map((c) => (
          <CommentNode
            key={c.id}
            node={c}
            depth={0}
            problemId={problemId}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            openSpoilers={openSpoilers}
            setOpenSpoilers={setOpenSpoilers}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            editingId={editingId}
            setEditingId={setEditingId}
            onRefresh={refresh}
            onRemove={remove}
            onReact={sendReaction}
          />
        ))}
      </div>
    </div>
  );
}

function CommentEditForm({
  problemId,
  node,
  onCancel,
  onSaved,
}: {
  problemId: string;
  node: ProblemCommentTreeNode;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = React.useState(node.body);
  const [containsSpoiler, setContainsSpoiler] = React.useState(node.containsSpoiler);
  const [removeImage, setRemoveImage] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    let res: Response;
    if (file || removeImage) {
      const fd = new FormData();
      fd.append("body", body);
      fd.append("containsSpoiler", containsSpoiler ? "true" : "false");
      if (removeImage) fd.append("removeImage", "true");
      if (file) fd.append("image", file);
      res = await fetch(`/api/problems/${problemId}/comments/${node.id}`, {
        method: "PATCH",
        credentials: "include",
        body: fd,
      });
    } else {
      res = await fetch(`/api/problems/${problemId}/comments/${node.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body, containsSpoiler }),
      });
    }
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data?.error ?? "Nu s-a putut salva");
      return;
    }
    onSaved();
  }

  const showExistingImage = node.imageUrl && !removeImage && !file;

  return (
    <form onSubmit={submit} className="mt-2 grid gap-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <div className="text-xs font-medium text-amber-950">Editează comentariul</div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={3}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      />
      {showExistingImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={node.imageUrl!} target="_blank" rel="noreferrer" className="inline-block max-w-sm">
          <img
            src={node.imageUrl!}
            alt=""
            className="max-h-36 rounded-lg border border-zinc-200 object-contain"
          />
        </a>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1">
          <span>Imagine nouă</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {node.imageUrl ? (
          <label className="inline-flex items-center gap-1 text-zinc-700">
            <input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} />
            Șterge imaginea
          </label>
        ) : null}
      </div>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="max-h-36 max-w-full rounded-lg border border-zinc-200 object-contain" />
      ) : null}
      <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={containsSpoiler}
          onChange={(e) => setContainsSpoiler(e.target.checked)}
        />
        Conține spoilere
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Anulează
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Se salvează…" : "Salvează"}
        </Button>
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </form>
  );
}

function CommentNode({
  node,
  depth,
  problemId,
  currentUserId,
  currentUsername,
  openSpoilers,
  setOpenSpoilers,
  replyingTo,
  setReplyingTo,
  editingId,
  setEditingId,
  onRefresh,
  onRemove,
  onReact,
}: {
  node: ProblemCommentTreeNode;
  depth: number;
  problemId: string;
  currentUserId: string | null;
  currentUsername: string | null;
  openSpoilers: Record<string, boolean>;
  setOpenSpoilers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  replyingTo: { id: string; username: string } | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<{ id: string; username: string } | null>>;
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  onRefresh: () => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReact: (commentId: string, value: "like" | "dislike" | "none") => Promise<void>;
}) {
  const spoilerOpen = openSpoilers[node.id] ?? false;
  const canModify = currentUsername != null && currentUsername === node.user.username;
  const [repliesOpen, setRepliesOpen] = React.useState(true);

  function toggleLike() {
    const next = node.myReaction === "LIKE" ? "none" : "like";
    void onReact(node.id, next);
  }

  function toggleDislike() {
    const next = node.myReaction === "DISLIKE" ? "none" : "dislike";
    void onReact(node.id, next);
  }

  return (
    <div className={depth > 0 ? "ml-1 border-l border-zinc-100 pl-3" : ""}>
      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {node.user.avatarUrl ? (
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-zinc-200">
                <Image src={node.user.avatarUrl} alt="" fill className="object-cover" sizes="28px" />
              </span>
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[10px] font-semibold text-zinc-600">
                {node.user.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <Link className={`font-medium hover:underline ${usernameColorClass(node.user.username) || "text-zinc-900"}`} href={`/u/${node.user.username}`}>
              @{node.user.username}
            </Link>
            {node.badges.isTeacher ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-900">Profesor</span>
            ) : null}
            {node.badges.isAuthor ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-950">Autor</span>
            ) : null}
            {node.badges.solved100 ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">Rezolvat 100</span>
            ) : null}
            <span className="text-zinc-500">{new Date(node.createdAt).toLocaleString()}</span>
            {node.editedAt ? (
              <span className="text-zinc-400 italic" title={new Date(node.editedAt).toLocaleString()}>
                (edited)
              </span>
            ) : null}
          </div>
        </div>
        {node.replyTo ? (
          <div className="mt-1 text-[11px] text-zinc-500">
            Răspuns la{" "}
            <Link href={`/u/${node.replyTo.username}`} className="text-[color:var(--accent)] hover:underline">
              @{node.replyTo.username}
            </Link>
          </div>
        ) : null}

        {editingId === node.id ? (
          <CommentEditForm
            problemId={problemId}
            node={node}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              void onRefresh();
            }}
          />
        ) : (
          <>
            {node.containsSpoiler && !spoilerOpen ? (
              <button
                type="button"
                onClick={() => setOpenSpoilers((s) => ({ ...s, [node.id]: true }))}
                className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950"
              >
                Spoiler — apasă pentru a dezvălui
              </button>
            ) : (
              <>
                {node.body.trim() ? (
                  <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{node.body}</div>
                ) : null}
                {node.imageUrl ? (
                  <a
                    href={node.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block max-w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={node.imageUrl}
                      alt=""
                      className="max-h-52 w-auto max-w-full rounded-lg border border-zinc-200 object-contain"
                    />
                  </a>
                ) : null}
              </>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2">
              {currentUserId ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setReplyingTo((prev) =>
                        prev?.id === node.id ? null : { id: node.id, username: node.user.username },
                      );
                    }}
                    className="text-xs font-medium text-[color:var(--accent)] hover:underline"
                  >
                    {replyingTo?.id === node.id ? "Anulează răspuns" : "Răspunde"}
                  </button>
                  <div className="flex items-center gap-1 text-xs text-zinc-600">
                    <button
                      type="button"
                      onClick={toggleLike}
                      className={`rounded-lg border px-2 py-0.5 ${
                        node.myReaction === "LIKE"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      ↑ {node.likes}
                    </button>
                    <button
                      type="button"
                      onClick={toggleDislike}
                      className={`rounded-lg border px-2 py-0.5 ${
                        node.myReaction === "DISLIKE"
                          ? "border-rose-300 bg-rose-50 text-rose-900"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      ↓ {node.dislikes}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-zinc-500">
                  ↑ {node.likes} · ↓ {node.dislikes}
                </div>
              )}
              {canModify ? (
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(node.id);
                      setReplyingTo(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    Editează
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(node.id)}
                    className="text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    Șterge
                  </button>
                </div>
              ) : null}
            </div>

            {currentUserId && replyingTo?.id === node.id ? (
              <div className="mt-3">
                <CommentComposer
                  problemId={problemId}
                  parentId={node.id}
                  replyHintUsername={node.user.username}
                  onCancel={() => setReplyingTo(null)}
                  onPosted={() => {
                    setReplyingTo(null);
                    void onRefresh();
                  }}
                  submitLabel="Postează răspunsul"
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {node.directReplyCount > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setRepliesOpen((v) => !v)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            {repliesOpen ? "Ascunde răspunsuri" : `Arată ${node.directReplyCount} ${node.directReplyCount === 1 ? "răspuns" : "răspunsuri"}`}
          </button>
          {repliesOpen ? (
            <div className="mt-2 grid gap-2">
              {node.replies.map((r) => (
                <CommentNode
                  key={r.id}
                  node={r}
                  depth={depth + 1}
                  problemId={problemId}
                  currentUserId={currentUserId}
                  currentUsername={currentUsername}
                  openSpoilers={openSpoilers}
                  setOpenSpoilers={setOpenSpoilers}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  onRefresh={onRefresh}
                  onRemove={onRemove}
                  onReact={onReact}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}