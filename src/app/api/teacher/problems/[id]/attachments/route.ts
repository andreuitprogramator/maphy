import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { storage } from "@/lib/storage/driver";

function detectAttachmentType(mimeType: string): "IMAGE" | "PDF" | null {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "application/pdf") return "PDF";
  return null;
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");
  const { id } = await ctx.params;

  const problem = await prisma.problem.findFirst({
    where: { id, createdById: teacher.id },
    select: {
      attachments: {
        orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
        select: {
          id: true,
          fileUrl: true,
          fileType: true,
          mimeType: true,
          originalName: true,
          caption: true,
          sortOrder: true,
          uploadedAt: true,
        },
      },
    },
  });
  if (!problem) return jsonError(404, "Problem not found");
  return jsonOk({ attachments: problem.attachments });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");
  const { id } = await ctx.params;

  const problem = await prisma.problem.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true },
  });
  if (!problem) return jsonError(404, "Problem not found");

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Invalid form data");
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
    folder: `problem-attachments/${teacher.id}/${id}`,
  });

  const maxSort = await prisma.problemAttachment.aggregate({
    where: { problemId: id },
    _max: { sortOrder: true },
  });

  const created = await prisma.problemAttachment.create({
    data: {
      problemId: id,
      fileUrl: stored.publicUrl,
      fileType,
      mimeType: file.type || (fileType === "PDF" ? "application/pdf" : "image/*"),
      originalName: file.name || "attachment",
      caption: String(form.get("caption") ?? "").slice(0, 2000),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      mimeType: true,
      originalName: true,
      caption: true,
      sortOrder: true,
      uploadedAt: true,
    },
  });

  return jsonOk({ attachment: created }, { status: 201 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const attachmentId = typeof body?.attachmentId === "string" ? body.attachmentId : null;
  if (!attachmentId) return jsonError(400, "Missing attachmentId");

  const own = await prisma.problem.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true },
  });
  if (!own) return jsonError(404, "Problem not found");

  await prisma.problemAttachment.deleteMany({
    where: { id: attachmentId, problemId: id },
  });

  return jsonOk({ ok: true });
}
