import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getAiGradingModel, getOpenAiApiKey, modelSupportsTemperature } from "@/lib/ai/config";
import { stripHtmlForPrompt } from "@/lib/html/strip";

// ─── Step 1 schema: MasterRubric ──────────────────────────────────────────────

const MasterRubricSchema = z.object({
  problem_summary: z.string(),
  rubric_breakdown: z.array(
    z.object({
      milestone_name: z.string(),
      allocated_points: z.number(),
      grading_criteria: z.string(),
    }),
  ),
});

type MasterRubric = z.infer<typeof MasterRubricSchema>;

// ─── Step 2 schema: FinalOlympiadGrade ───────────────────────────────────────

const OlympiadGradingSchema = z.object({
  readability: z.enum(["readable", "rejected"]),
  rejection_reason: z.string().nullable(),
  total_score: z.number().nullable(),
  breakdown: z.array(
    z.object({
      milestone_name: z.string(),
      points_earned: z.number(),
      points_possible: z.number(),
      justification: z.string(),
    }),
  ),
  diagrammatic_feedback: z.string(),
  algebraic_feedback: z.string(),
});

type OlympiadGrading = z.infer<typeof OlympiadGradingSchema>;

// ─── SimpleGraderResult (unchanged — service.ts compatibility) ────────────────

export const SimpleGraderResultSchema = z.object({
  readability: z.enum(["readable", "rejected"]),
  rejection_reason: z.string().nullable(),
  total_barem: z.number().nullable(),
  puncte_obtinute: z.number().nullable(),
  criterii: z.array(
    z.object({
      label: z.string(),
      puncte_maxime: z.number(),
      puncte_obtinute: z.number(),
      ce_a_fost_corect: z.string(),
      ce_lipseste_sau_e_gresit: z.string(),
    }),
  ),
  feedback_general: z.string().nullable(),
  puncte_forte: z.array(z.string()),
  de_imbunatatit: z.array(z.string()),
});

export type SimpleGraderResult = z.infer<typeof SimpleGraderResultSchema>;

export type SimplePipelineValidation =
  | { valid: true }
  | { valid: false; reason: string };

// ─── Pure helpers (exported for tests) ───────────────────────────────────────

export function computeSimpleScore(puncteObtinute: number, totalBarem: number): number {
  if (totalBarem <= 0) return 0;
  return Math.round((100 * Math.max(0, puncteObtinute)) / totalBarem);
}

export function validateSimpleResult(result: SimpleGraderResult): SimplePipelineValidation {
  if (result.readability === "rejected") return { valid: true };

  const total = result.total_barem;
  const obtained = result.puncte_obtinute;

  if (total == null || total <= 0)
    return { valid: false, reason: `total_barem invalid: ${String(total)}` };
  if (obtained == null || obtained < 0)
    return { valid: false, reason: `puncte_obtinute invalid: ${String(obtained)}` };
  if (obtained > total + 0.01)
    return { valid: false, reason: `puncte_obtinute (${obtained}) > total_barem (${total})` };

  for (const c of result.criterii) {
    if (c.puncte_obtinute < 0)
      return { valid: false, reason: `criteriu "${c.label}": puncte_obtinute < 0` };
    if (c.puncte_obtinute > c.puncte_maxime + 0.01)
      return {
        valid: false,
        reason: `criteriu "${c.label}": puncte_obtinute (${c.puncte_obtinute}) > puncte_maxime (${c.puncte_maxime})`,
      };
  }

  const sumCriterii = result.criterii.reduce((s, c) => s + c.puncte_obtinute, 0);
  if (Math.abs(sumCriterii - obtained) > 0.5)
    return {
      valid: false,
      reason: `suma criteriilor (${sumCriterii}) diferă de puncte_obtinute (${obtained})`,
    };

  return { valid: true };
}

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: getOpenAiApiKey() });
  return _client;
}

function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

// ─── Step 1: Generate master rubric from problem + barem ─────────────────────

async function generateMasterRubric(args: {
  statement: string;
  rubricText: string;
  statementImages: Array<{ mimeType: string; bytes: Uint8Array }>;
  rubricImages: Array<{ mimeType: string; bytes: Uint8Array }>;
}): Promise<MasterRubric> {
  const client = getClient();
  const model = getAiGradingModel();

  const rubricPrompt =
    "Analizează enunțul problemei de fizică și soluția oficială (baremul). " +
    "Extrage punctele numerice EXACT din marcajele baremului din imagine. " +
    "IMPORTANT: Creează EXACT câte criterii există în barem — câte secțiuni sau subpuncte are baremul, atâtea criterii. " +
    "NU subdiviza niciun criteriu în sub-pași. NU combina criterii separate. " +
    "Copiază etichetele secțiunilor exact din barem (ex. 'II.A – Reprezentarea forțelor', 'II.B – Calculul forței'). " +
    "Un criteriu = o secțiune din barem, cu punctajul ei total.";

  type ContentItem =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } };

  const contentItems: ContentItem[] = [{ type: "text", text: rubricPrompt }];

  contentItems.push({ type: "text", text: "--- ENUNȚUL PROBLEMEI ---" });
  if (args.statementImages.length > 0) {
    for (const img of args.statementImages) {
      contentItems.push({
        type: "image_url",
        image_url: { url: toDataUrl(img.bytes, img.mimeType), detail: "high" },
      });
    }
  } else {
    contentItems.push({ type: "text", text: args.statement || "(indisponibil)" });
  }

  contentItems.push({ type: "text", text: "--- SOLUȚIA OFICIALĂ (BAREM) ---" });
  if (args.rubricImages.length > 0) {
    for (const img of args.rubricImages) {
      contentItems.push({
        type: "image_url",
        image_url: { url: toDataUrl(img.bytes, img.mimeType), detail: "high" },
      });
    }
  } else {
    contentItems.push({ type: "text", text: args.rubricText || "(indisponibil)" });
  }

  const response = await client.chat.completions.parse({
    model,
    ...(modelSupportsTemperature(model) ? { temperature: 0 } : {}),
    messages: [
      {
        role: "system",
        content:
          "Ești compilatorul principal al schemelor de notare pentru Olimpiadele Internaționale de Fizică. Returnezi EXCLUSIV JSON valid.",
      },
      {
        role: "user",
        content: contentItems,
      },
    ],
    response_format: zodResponseFormat(MasterRubricSchema, "master_rubric"),
  });

  const parsed = response.choices[0].message.parsed;
  if (!parsed) throw new Error("[generateMasterRubric] Model returned no parsed result");
  return parsed;
}

// ─── Step 2: Grade student submission against frozen rubric ───────────────────

async function gradeAgainstFrozenRubric(args: {
  studentImageBytes: Uint8Array;
  studentImageMimeType: string;
  frozenRubric: MasterRubric;
  ocrText?: string | null;
}): Promise<OlympiadGrading> {
  const client = getClient();
  const model = getAiGradingModel();

  const evaluationPrompt = [
    "Ești un judecător de Olimpiadă. Evaluează lucrarea elevului strict conform Rubricii Fixe furnizate.",
    "Lucrarea elevului poate consta din mai multe pagini. Analizează-le pentru a găsi soluția completă.",
    "",
    "Reguli:",
    "1. Nu aplica deduceri micro pentru pași triviali omisi sau stilul scrisului dacă derivarea fizică este corectă.",
    "2. Dacă o parte specifică din rubrică nu a fost abordată în lucrarea elevului, acordă 0 puncte pentru acele elemente.",
    "3. Aplică regulile de propagare a erorilor corect. Nu penaliza pașii următori dacă algebra inițială a fost greșită, dar logica fizică a rămas corectă.",
    "4. Imaginea elevului este SINGURA sursă de dovezi. Valorile din rubrică NU constituie dovezi ale muncii elevului.",
    "5. Dacă imaginea este necitibilă sau goală, setează readability='rejected' și explică în rejection_reason.",
    "6. Toate textele trebuie scrise în ROMÂNĂ.",
    "7. Criteriul 'Oficiu' (sau similar) se acordă AUTOMAT în totalitate dacă elevul a depus orice lucrare scrisă. Nu verifica imaginea pentru acest criteriu.",
    "8. NU acorda puncte parțiale dacă nu există dovezi CLARE și VIZIBILE ale muncii în imagine pentru acel subpunct. Dacă nu există nimic scris pentru un subpunct, acordă 0 — nu 'parțial' din lipsă de dovezi.",
    "",
    `RUBRICA FIXĂ DE URMAT EXCLUSIV:\n${JSON.stringify(args.frozenRubric, null, 2)}`,
    "",
    args.ocrText ? `TEXT OCR (informativ, poate fi zgomotos):\n${args.ocrText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.chat.completions.parse({
    model,
    ...(modelSupportsTemperature(model) ? { temperature: 0 } : {}),
    messages: [
      {
        role: "system",
        content:
          "Ești un corector de fizică precis și corect. Folosești rubrica JSON furnizată pentru a corecta elevul pas cu pas. Returnezi EXCLUSIV JSON valid.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: evaluationPrompt },
          {
            type: "image_url",
            image_url: {
              url: toDataUrl(args.studentImageBytes, args.studentImageMimeType),
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: zodResponseFormat(OlympiadGradingSchema, "olympiad_grading"),
  });

  const parsed = response.choices[0].message.parsed;
  if (!parsed) throw new Error("[gradeAgainstFrozenRubric] Model returned no parsed result");
  return parsed;
}

// ─── Main grading function ────────────────────────────────────────────────────

export async function gradeSimpleWithOpenAi(args: {
  statement: string;
  rubricText: string;
  studentImageBytes: Uint8Array;
  studentImageMimeType: string;
  ocrText: string | null | undefined;
  statementImages?: Array<{ mimeType: string; bytes: Uint8Array }>;
  rubricImages?: Array<{ mimeType: string; bytes: Uint8Array }>;
}): Promise<SimpleGraderResult> {
  console.info("[gradeSimple] Step 1: generating master rubric...");
  const masterRubric = await generateMasterRubric({
    statement: stripHtmlForPrompt(args.statement),
    rubricText: args.rubricText,
    statementImages: args.statementImages ?? [],
    rubricImages: args.rubricImages ?? [],
  });
  console.info(
    `[gradeSimple] Master rubric generated: ${masterRubric.rubric_breakdown.length} milestones, total=${masterRubric.rubric_breakdown.reduce((s, r) => s + r.allocated_points, 0)} points`,
  );

  // Step 2 — 4 apeluri paralele, alegem al doilea cel mai mic
  console.info("[gradeSimple] Step 2: grading x4 in parallel...");
  const gradingArgs = {
    studentImageBytes: args.studentImageBytes,
    studentImageMimeType: args.studentImageMimeType,
    frozenRubric: masterRubric,
    ocrText: args.ocrText,
  };
  const [r1, r2, r3, r4] = await Promise.all([
    gradeAgainstFrozenRubric(gradingArgs),
    gradeAgainstFrozenRubric(gradingArgs),
    gradeAgainstFrozenRubric(gradingArgs),
    gradeAgainstFrozenRubric(gradingArgs),
  ]);

  const allFour = [r1, r2, r3, r4];
  const readable = allFour.filter((g) => g.readability === "readable" && g.total_score != null);
  console.info(
    `[gradeSimple] Scores: ${allFour.map((g) => g.total_score ?? "rejected").join(", ")} — readable=${readable.length}/4`,
  );

  // Sortăm crescător și luăm al doilea cel mai mic (index 1)
  let grading: OlympiadGrading;
  if (readable.length === 0) {
    grading = r1;
  } else if (readable.length === 1) {
    grading = readable[0]!;
  } else {
    const sorted = [...readable].sort((a, b) => (a.total_score ?? 0) - (b.total_score ?? 0));
    grading = sorted[1]!; // al doilea cel mai mic
  }

  console.info(`[gradeSimple] Selected: readability=${grading.readability} total_score=${grading.total_score}`);

  // ── Rejected image ────────────────────────────────────────────────────────
  if (grading.readability === "rejected") {
    return {
      readability: "rejected",
      rejection_reason: grading.rejection_reason,
      total_barem: null,
      puncte_obtinute: null,
      criterii: [],
      feedback_general: null,
      puncte_forte: [],
      de_imbunatatit: [],
    };
  }

  // ── Map to SimpleGraderResult ─────────────────────────────────────────────
  const totalBarem = masterRubric.rubric_breakdown.reduce((s, r) => s + r.allocated_points, 0);
  const puncteObtinute = grading.breakdown.reduce((s, b) => s + b.points_earned, 0);

  const puncteFort: string[] = [];
  const deImbunatatit: string[] = [];
  for (const item of grading.breakdown) {
    const fraction = item.points_possible > 0 ? item.points_earned / item.points_possible : 0;
    if (fraction >= 0.8 && item.points_earned > 0) {
      puncteFort.push(`${item.milestone_name}: ${item.justification}`);
    } else if (fraction < 0.5) {
      deImbunatatit.push(`${item.milestone_name}: ${item.justification}`);
    }
  }

  const criterii = grading.breakdown.map((b) => ({
    label: b.milestone_name,
    puncte_maxime: b.points_possible,
    puncte_obtinute: b.points_earned,
    ce_a_fost_corect: b.points_earned > 0 ? b.justification : "",
    ce_lipseste_sau_e_gresit: b.points_earned < b.points_possible ? b.justification : "",
  }));

  const feedbackParts = [
    grading.diagrammatic_feedback ? `Diagrame: ${grading.diagrammatic_feedback}` : "",
    grading.algebraic_feedback ? `Algebră: ${grading.algebraic_feedback}` : "",
  ].filter(Boolean);

  return {
    readability: "readable",
    rejection_reason: null,
    total_barem: totalBarem,
    puncte_obtinute: puncteObtinute,
    criterii,
    feedback_general: feedbackParts.join("\n\n") || null,
    puncte_forte: puncteFort,
    de_imbunatatit: deImbunatatit,
  };
}
