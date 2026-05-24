import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { generateMasterRubric, type MasterRubric } from "@/lib/ai/grader-simple";

function publicUrlToDiskPath(publicUrl: string) {
  const clean = publicUrl.startsWith("/") ? publicUrl.slice(1) : publicUrl;
  return path.join(process.cwd(), "public", ...clean.split("/"));
}

function detectMimeType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

async function loadImageBytes(fileUrl: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (!fileUrl.startsWith("/")) return null;
  try {
    const bytes = new Uint8Array(await readFile(publicUrlToDiskPath(fileUrl)));
    const mimeType = detectMimeType(bytes);
    return mimeType.startsWith("image/") ? { bytes, mimeType } : null;
  } catch {
    return null;
  }
}

const BodySchema = z.object({
  orderNumber: z.number().int().min(1).max(20),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "orderNumber invalid");

  const { orderNumber } = parsed.data;

  const contestSet = await prisma.contestSet.findFirst({
    where: { id, createdById: teacher.id },
    select: {
      id: true,
      attachments: {
        where: {
          fileType: "IMAGE",
          role: { in: ["PROBLEM_STATEMENT", "PROBLEM_RUBRIC"] },
          problemOrderNumber: orderNumber,
        },
        select: { fileUrl: true, role: true },
        orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
      },
      problems: {
        where: { orderNumber },
        select: { id: true, statementTextOverride: true },
      },
    },
  });

  if (!contestSet) return jsonError(404, "Contest set not found");

  const statementAtts = contestSet.attachments.filter((a) => a.role === "PROBLEM_STATEMENT");
  const rubricAtts = contestSet.attachments.filter((a) => a.role === "PROBLEM_RUBRIC");

  if (rubricAtts.length === 0) {
    return jsonError(400, "Adaugă mai întâi pozele baremului pentru această problemă.");
  }

  const [statementImages, rubricImages] = await Promise.all([
    Promise.all(statementAtts.slice(0, 8).map((a) => loadImageBytes(a.fileUrl))).then(
      (r) => r.filter(Boolean) as Array<{ bytes: Uint8Array; mimeType: string }>,
    ),
    Promise.all(rubricAtts.slice(0, 8).map((a) => loadImageBytes(a.fileUrl))).then(
      (r) => r.filter(Boolean) as Array<{ bytes: Uint8Array; mimeType: string }>,
    ),
  ]);

  const problem = contestSet.problems[0];
  const statement = problem?.statementTextOverride ?? "(Cerința este în imaginile atașate.)";

  let rubric: MasterRubric;
  try {
    rubric = await generateMasterRubric({
      statement,
      rubricText: "(Baremul este în imaginile atașate.)",
      statementImages,
      rubricImages,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-rubric] AI error:", msg);
    return jsonError(500, "Generarea rubricii a eșuat. Încearcă din nou.");
  }

  // Save to DB — upsert so it works even if the problem row doesn't exist yet
  await prisma.contestSetProblem.upsert({
    where: { contestSetId_orderNumber: { contestSetId: contestSet.id, orderNumber } },
    create: {
      contestSetId: contestSet.id,
      orderNumber,
      title: `Problema ${orderNumber}`,
      maxScore: 100,
      aiRubricJson: JSON.stringify(rubric),
    },
    update: { aiRubricJson: JSON.stringify(rubric) },
  });

  return jsonOk({ rubric });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "orderNumber invalid");

  const { orderNumber } = parsed.data;

  const problem = await prisma.contestSetProblem.findFirst({
    where: { contestSet: { id, createdById: teacher.id }, orderNumber },
    select: { id: true },
  });
  if (!problem) return jsonError(404, "Problema nu a fost găsită");

  await prisma.contestSetProblem.update({
    where: { id: problem.id },
    data: { aiRubricJson: null },
  });

  return jsonOk({ ok: true });
}
