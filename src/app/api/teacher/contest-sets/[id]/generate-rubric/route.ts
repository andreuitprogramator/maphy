import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { generateMasterRubric, detectSubjectPageRanges, type MasterRubric } from "@/lib/ai/grader-simple";

async function loadPdfBytes(publicUrl: string | null | undefined): Promise<Uint8Array | null> {
  if (!publicUrl) return null;
  try {
    if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
      const res = await fetch(publicUrl);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    if (publicUrl.startsWith("/")) {
      const clean = publicUrl.slice(1);
      const diskPath = path.join(process.cwd(), "public", ...clean.split("/"));
      return new Uint8Array(await readFile(diskPath));
    }
    return null;
  } catch {
    return null;
  }
}

const BodySchema = z.object({
  totalProblems: z.number().int().min(1).max(20),
});

const DeleteBodySchema = z.object({
  orderNumber: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "totalProblems invalid");

  const { totalProblems } = parsed.data;

  const contestSet = await prisma.contestSet.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true, statementText: true, rubricText: true, statementPdfUrl: true, rubricPdfUrl: true },
  });

  if (!contestSet) return jsonError(404, "Contest set not found");

  const statementText = contestSet.statementText ?? "";
  const rubricText = contestSet.rubricText ?? "";

  if (!rubricText.trim() && !contestSet.rubricPdfUrl) {
    return jsonError(400, "Adaugă textul baremului sau încarcă PDF-ul baremului înainte de generate.");
  }

  // Load PDF bytes — AI reads them natively (formulas, layout intact)
  const [statementPdfBytes, rubricPdfBytes] = await Promise.all([
    loadPdfBytes(contestSet.statementPdfUrl),
    loadPdfBytes(contestSet.rubricPdfUrl),
  ]);

  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
                 "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

  // Detectează paginile fiecărui subiect din barem (pentru a evita overlap între pagini)
  const pageRanges = rubricPdfBytes
    ? await detectSubjectPageRanges({ rubricPdfBytes, totalProblems })
    : {};

  console.log("[generate-rubric] page ranges detected:", JSON.stringify(pageRanges));

  // Generate IRG for each problem in parallel
  let rubrics: MasterRubric[];
  try {
    rubrics = await Promise.all(
      Array.from({ length: totalProblems }, (_, i) => i + 1).map((n) => {
        const roman = ROMAN[n - 1] ?? String(n);
        const pages = pageRanges[n];
        const pageNote = pages
          ? `Subiectul ${roman} se află pe paginile ${pages.startPage}–${pages.endPage} din PDF. CITEȘTE EXCLUSIV aceste pagini și IGNORĂ restul paginilor.`
          : "";
        const statementInstruction =
          `⚠️ INSTRUCȚIUNE CRITICĂ: Extrage EXCLUSIV cerința Subiectului ${roman} ` +
          `(al ${n}-lea subiect din ${totalProblems} total). ` +
          `IGNORĂ complet Subiectele ${ROMAN.slice(0, totalProblems).filter((_, i) => i !== n - 1).join(", ")}. ` +
          `Răspunde ca și cum documentul conține DOAR Subiectul ${roman}.`;
        const rubricInstruction =
          `⚠️ INSTRUCȚIUNE CRITICĂ: Extrage EXCLUSIV baremul Subiectului ${roman} ` +
          `(al ${n}-lea subiect din ${totalProblems} total). ` +
          (pageNote ? `${pageNote} ` : "") +
          `IGNORĂ complet baremul Subiectelor ${ROMAN.slice(0, totalProblems).filter((_, i) => i !== n - 1).join(", ")}. ` +
          `Creează criterii DOAR pentru Subiectul ${roman}.`;
        return generateMasterRubric({
          statement: statementInstruction + (statementText.trim() ? `\n\n${statementText}` : ""),
          rubricText: rubricInstruction + (rubricText.trim() ? `\n\n${rubricText}` : ""),
          statementImages: [],
          rubricImages: [],
          statementPdfBytes: statementPdfBytes ?? undefined,
          rubricPdfBytes: rubricPdfBytes ?? undefined,
          rubricPageHint: pageNote,
        });
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-rubric] AI error:", msg);
    if (msg.includes("503") || msg.includes("Service Unavailable") || msg.includes("overloaded"))
      return jsonError(503, "Serviciul AI este momentan supraîncărcat. Încearcă din nou în 30 de secunde.");
    if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota"))
      return jsonError(429, "Limita de cereri AI a fost depășită. Încearcă din nou în câteva minute.");
    return jsonError(500, "Generarea rubricilor a eșuat. Încearcă din nou.");
  }

  // Save each rubric to its ContestSetProblem
  await Promise.all(
    rubrics.map((rubric, i) => {
      const orderNumber = i + 1;
      return prisma.contestSetProblem.upsert({
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
    }),
  );

  return jsonOk({ rubrics, totalProblems });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = DeleteBodySchema.safeParse(body);

  const contestSet = await prisma.contestSet.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true },
  });
  if (!contestSet) return jsonError(404, "Contest set not found");

  if (parsed.success && parsed.data.orderNumber != null) {
    // Delete rubric for a specific problem
    const problem = await prisma.contestSetProblem.findFirst({
      where: { contestSetId: id, orderNumber: parsed.data.orderNumber },
      select: { id: true },
    });
    if (problem) {
      await prisma.contestSetProblem.update({
        where: { id: problem.id },
        data: { aiRubricJson: null },
      });
    }
  } else {
    // Delete all rubrics
    await prisma.contestSetProblem.updateMany({
      where: { contestSetId: id },
      data: { aiRubricJson: null },
    });
  }

  return jsonOk({ ok: true });
}
