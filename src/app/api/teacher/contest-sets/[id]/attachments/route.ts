import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { storage } from "@/lib/storage/driver";

function detectAttachmentType(mimeType: string): "IMAGE" | "PDF" | null {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "application/pdf") return "PDF";
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");
  const { id } = await ctx.params;

  const contestSet = await prisma.contestSet.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true },
  });
  if (!contestSet) return jsonError(404, "Contest set not found");

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Invalid form data");

  const role = String(form.get("role") ?? "SUPPORTING").toUpperCase();
  if (!["STATEMENT", "RUBRIC", "SUPPORTING", "PROBLEM_STATEMENT", "PROBLEM_RUBRIC"].includes(role)) {
    return jsonError(400, "Invalid role");
  }
  const problemOrderNumberRaw = form.get("problemOrderNumber");
  const problemOrderNumber =
    problemOrderNumberRaw == null || String(problemOrderNumberRaw).trim() === ""
      ? null
      : Number(problemOrderNumberRaw);
  if ((role === "PROBLEM_STATEMENT" || role === "PROBLEM_RUBRIC") && (!Number.isInteger(problemOrderNumber) || problemOrderNumber! < 1 || problemOrderNumber! > 20)) {
    return jsonError(400, "problemOrderNumber is required for problem-level assets (1..20)");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Missing file");

  const fileType = detectAttachmentType(file.type);
  if (!fileType) return jsonError(400, "Only image and PDF files are allowed");
  if (fileType === "IMAGE" && file.size > 10 * 1024 * 1024) return jsonError(400, "Image too large (max 10MB)");
  if (fileType === "PDF" && file.size > 20 * 1024 * 1024) return jsonError(400, "PDF too large (max 20MB)");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storage.saveFile({
    bytes,
    filename: file.name || (fileType === "PDF" ? "attachment.pdf" : "attachment"),
    folder: `contest-set-attachments/${teacher.id}/${id}`,
  });

  const maxSort = await prisma.contestSetAttachment.aggregate({
    where: { contestSetId: id },
    _max: { sortOrder: true },
  });

  const attachment = await prisma.contestSetAttachment.create({
    data: {
      contestSetId: id,
      fileUrl: stored.publicUrl,
      fileType,
      mimeType: file.type || (fileType === "PDF" ? "application/pdf" : "image/*"),
      originalName: file.name || "attachment",
      role,
      problemOrderNumber: role === "PROBLEM_STATEMENT" || role === "PROBLEM_RUBRIC" ? problemOrderNumber : null,
      problemAssetType: role === "PROBLEM_STATEMENT" ? "STATEMENT_IMAGE" : role === "PROBLEM_RUBRIC" ? "RUBRIC_IMAGE" : null,
      caption: String(form.get("caption") ?? "").slice(0, 2000),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      mimeType: true,
      role: true,
      problemOrderNumber: true,
      problemAssetType: true,
      originalName: true,
      caption: true,
      sortOrder: true,
      uploadedAt: true,
    },
  });

  if (role === "STATEMENT" && fileType === "PDF") {
    await prisma.contestSet.update({ where: { id }, data: { statementPdfUrl: attachment.fileUrl } });
  }
  if (role === "RUBRIC" && fileType === "PDF") {
    await prisma.contestSet.update({ where: { id }, data: { rubricPdfUrl: attachment.fileUrl } });
  }

  return jsonOk({ attachment }, { status: 201 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const attachmentId = typeof body?.attachmentId === "string" ? body.attachmentId : null;
  if (!attachmentId) return jsonError(400, "Missing attachmentId");

  const own = await prisma.contestSet.findFirst({ where: { id, createdById: teacher.id }, select: { id: true } });
  if (!own) return jsonError(404, "Contest set not found");

  const deleted = await prisma.contestSetAttachment.findFirst({ where: { id: attachmentId, contestSetId: id } });
  if (deleted) {
    await prisma.contestSetAttachment.delete({ where: { id: deleted.id } });
    if (deleted.role === "STATEMENT") await prisma.contestSet.update({ where: { id }, data: { statementPdfUrl: null } });
    if (deleted.role === "RUBRIC") await prisma.contestSet.update({ where: { id }, data: { rubricPdfUrl: null } });
  }

  return jsonOk({ ok: true });
}
