import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { z } from "zod";
import { getGeminiApiKey, getGeminiRubricModel } from "@/lib/ai/config";
import { stripHtmlForPrompt } from "@/lib/html/strip";

// ─── Retry helper for transient Gemini errors (503, 429) ─────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes("503") || msg.includes("429") || msg.includes("Service Unavailable") || msg.includes("Too Many Requests");
      if (!isTransient || attempt === maxAttempts) throw err;
      const delayMs = 2000 * attempt; // 2s, 4s, 6s
      console.warn(`[gemini] transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ─── Step 1 schema: MasterRubric ──────────────────────────────────────────────

export const MasterRubricSchema = z.object({
  problem_summary: z.string(),
  rubric_breakdown: z.array(
    z.object({
      milestone_name: z.string(),
      allocated_points: z.number(),
      grading_criteria: z.string(),
    }),
  ),
});

export type MasterRubric = z.infer<typeof MasterRubricSchema>;

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
  visual_feedback: z.string(),
  reasoning_feedback: z.string(),
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

let _geminiClient: GoogleGenerativeAI | null = null;
function getGeminiClient() {
  if (!_geminiClient) _geminiClient = new GoogleGenerativeAI(getGeminiApiKey());
  return _geminiClient;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${toBase64(bytes)}`;
}

// ─── Step 1: Generate master rubric from problem + barem (Gemini) ─────────────

export async function generateMasterRubric(args: {
  statement: string;
  rubricText: string;
  statementImages: Array<{ mimeType: string; bytes: Uint8Array }>;
  rubricImages: Array<{ mimeType: string; bytes: Uint8Array }>;
  statementPdfBytes?: Uint8Array;
  rubricPdfBytes?: Uint8Array;
  rubricPageHint?: string;
}): Promise<MasterRubric> {
  const gemini = getGeminiClient();
  const modelName = getGeminiRubricModel();

  const model = gemini.getGenerativeModel({
    model: modelName,
    systemInstruction:
      "Ești compilatorul principal al schemelor de notare pentru concursuri de matematică, fizică și chimie. " +
      "Returnezi EXCLUSIV JSON valid conform schemei cerute.",
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          problem_summary: { type: SchemaType.STRING },
          rubric_breakdown: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                milestone_name: { type: SchemaType.STRING },
                allocated_points: { type: SchemaType.NUMBER },
                grading_criteria: { type: SchemaType.STRING },
              },
              required: ["milestone_name", "allocated_points", "grading_criteria"],
            },
          },
        },
        required: ["problem_summary", "rubric_breakdown"],
      },
    },
  });

  const rubricPrompt =
    "Analizează enunțul problemei și soluția oficială (baremul). " +
    "Extrage punctele numerice EXACT din marcajele baremului. " +
    "REGULA PRINCIPALĂ: Orice linie sau bloc din barem care are un punctaj explicit tipărit lângă el (ex. '1p', '2p', '……1p') " +
    "reprezintă un criteriu SEPARAT — indiferent dacă are sau nu o etichetă de secțiune (A), B), etc.). " +
    "NU combina niciodată două linii cu punctaje diferite într-un singur criteriu. " +
    "NU subdiviza o linie cu un singur punctaj în sub-pași. " +
    "Numărul total de criterii = numărul exact de linii/blocuri cu punctaje din barem. " +
    "Copiază etichetele secțiunilor exact din barem (ex. 'A – Reprezentarea forțelor', 'B – Calculul forței'). " +
    "Pentru liniile fără etichetă de secțiune, folosește conținutul matematic ca etichetă (ex. 'Ecuația de echilibru').";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: rubricPrompt }];

  parts.push({ text: "--- ENUNȚUL PROBLEMEI ---" });
  if (args.statement) parts.push({ text: args.statement });
  if (args.statementPdfBytes) {
    parts.push({ inlineData: { mimeType: "application/pdf", data: toBase64(args.statementPdfBytes) } });
  } else if (args.statementImages.length > 0) {
    for (const img of args.statementImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: toBase64(img.bytes) } });
    }
  } else if (!args.statement) {
    parts.push({ text: "(indisponibil)" });
  }

  parts.push({ text: "--- SOLUȚIA OFICIALĂ (BAREM) ---" });
  if (args.rubricPageHint) parts.push({ text: `📌 ${args.rubricPageHint}` });
  if (args.rubricText) parts.push({ text: args.rubricText });
  if (args.rubricPdfBytes) {
    parts.push({ inlineData: { mimeType: "application/pdf", data: toBase64(args.rubricPdfBytes) } });
  } else if (args.rubricImages.length > 0) {
    for (const img of args.rubricImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: toBase64(img.bytes) } });
    }
  } else if (!args.rubricText) {
    parts.push({ text: "(indisponibil)" });
  }

  const result = await withRetry(() => model.generateContent(parts));
  const text = result.response.text();
  const parsed = MasterRubricSchema.parse(JSON.parse(text));
  return parsed;
}

// ─── Step 2: Grade student submission against frozen rubric (Gemini) ──────────

async function gradeAgainstFrozenRubric(args: {
  studentImages: Array<{ bytes: Uint8Array; mimeType: string }>;
  frozenRubric: MasterRubric;
  ocrText?: string | null;
}): Promise<OlympiadGrading> {
  const gemini = getGeminiClient();
  const modelName = getGeminiRubricModel();

  const model = gemini.getGenerativeModel({
    model: modelName,
    systemInstruction:
      "Ești un corector precis și corect pentru concursuri de matematică, fizică și chimie. " +
      "Folosești rubrica JSON furnizată pentru a corecta elevul pas cu pas. Returnezi EXCLUSIV JSON valid.",
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          readability: { type: SchemaType.STRING, enum: ["readable", "rejected"] },
          rejection_reason: { type: SchemaType.STRING, nullable: true },
          total_score: { type: SchemaType.NUMBER, nullable: true },
          breakdown: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                milestone_name: { type: SchemaType.STRING },
                points_earned: { type: SchemaType.NUMBER },
                points_possible: { type: SchemaType.NUMBER },
                justification: { type: SchemaType.STRING },
              },
              required: ["milestone_name", "points_earned", "points_possible", "justification"],
            },
          },
          visual_feedback: { type: SchemaType.STRING },
          reasoning_feedback: { type: SchemaType.STRING },
        },
        required: ["readability", "rejection_reason", "total_score", "breakdown", "visual_feedback", "reasoning_feedback"],
      },
    },
  });

  const evaluationPrompt = [
    "Ești un corector de concurs. Evaluează lucrarea elevului conform Rubricii Fixe furnizate, cu înțelegere față de greșelile minore.",
    `Lucrarea elevului constă din ${args.studentImages.length} imagine(i). Analizează-le pe TOATE pentru a găsi soluția completă.`,
    "",
    `SUBIECTUL PROBLEMEI DE CORECTAT: ${args.frozenRubric.problem_summary}`,
    "",
    "VERIFICARE OBLIGATORIE ÎNAINTE DE ORICE ALTCEVA:",
    "Verifică dacă lucrarea elevului tratează ACELAȘI subiect cu problema de mai sus.",
    "Dacă elevul a trimis o rezolvare pentru o altă problemă, un barem, un document pentru un subiect complet diferit sau orice conținut care nu are legătură cu subiectul de corectat — setează readability='rejected' cu rejection_reason='Lucrarea nu corespunde problemei de corectat.' și acordă 0 la toate criteriile.",
    "",
    "Reguli (aplică DOAR dacă lucrarea corespunde problemei):",
    "1. Fii înțelegător cu greșelile de calcul minore, notații imperfecte sau pași exprimați ușor diferit față de barem — dacă raționamentul și ideea sunt corecte, acordă punctele.",
    "2. Dacă elevul a demonstrat că înțelege conceptul dar a făcut o greșeală de aritmetică, nu penaliza toți pașii următori — aplică propagarea erorilor.",
    "3. Dacă un pas e parțial corect (ideea bună, execuție incompletă), acordă punctaj parțial proporțional.",
    "4. Dacă un subpunct nu apare deloc în lucrare — nu a fost scris nimic relevant — acordă 0. Nu inventa muncă inexistentă.",
    "5. Dacă imaginile sunt necitibile sau goale, setează readability='rejected' și explică în rejection_reason.",
    "6. Toate textele trebuie scrise în ROMÂNĂ.",
    "7. Criteriul 'Oficiu' sau orice criteriu administrativ similar se acordă AUTOMAT în totalitate dacă elevul a depus orice lucrare scrisă.",
    "",
    `RUBRICA FIXĂ DE URMAT EXCLUSIV:\n${JSON.stringify(args.frozenRubric, null, 2)}`,
    "",
    args.ocrText ? `TEXT OCR (informativ, poate fi zgomotos):\n${args.ocrText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: evaluationPrompt }];
  for (const img of args.studentImages) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: toBase64(img.bytes) } });
  }

  const result = await withRetry(() => model.generateContent(parts));
  const parsed = OlympiadGradingSchema.parse(JSON.parse(result.response.text()));
  return parsed;
}

// ─── Main grading function ────────────────────────────────────────────────────

export async function gradeSimpleWithOpenAi(args: {
  statement: string;
  rubricText: string;
  studentImages: Array<{ bytes: Uint8Array; mimeType: string }>;
  ocrText: string | null | undefined;
  statementImages?: Array<{ mimeType: string; bytes: Uint8Array }>;
  rubricImages?: Array<{ mimeType: string; bytes: Uint8Array }>;
  preGeneratedRubric?: MasterRubric;
}): Promise<SimpleGraderResult> {
  let masterRubric: MasterRubric;
  if (args.preGeneratedRubric) {
    masterRubric = args.preGeneratedRubric;
    console.info(
      `[gradeSimple] Using pre-generated rubric: ${masterRubric.rubric_breakdown.length} milestones, total=${masterRubric.rubric_breakdown.reduce((s, r) => s + r.allocated_points, 0)} points`,
    );
  } else {
    console.info("[gradeSimple] Step 1: generating master rubric...");
    masterRubric = await generateMasterRubric({
      statement: stripHtmlForPrompt(args.statement),
      rubricText: args.rubricText,
      statementImages: args.statementImages ?? [],
      rubricImages: args.rubricImages ?? [],
    });
    console.info(
      `[gradeSimple] Master rubric generated: ${masterRubric.rubric_breakdown.length} milestones, total=${masterRubric.rubric_breakdown.reduce((s, r) => s + r.allocated_points, 0)} points`,
    );
  }

  // Step 2 — 2 apeluri paralele, media per subpunct
  console.info("[gradeSimple] Step 2: grading x2 in parallel...");
  const gradingArgs = {
    studentImages: args.studentImages,
    frozenRubric: masterRubric,
    ocrText: args.ocrText,
  };
  const [r1, r2] = await Promise.all([
    gradeAgainstFrozenRubric(gradingArgs),
    gradeAgainstFrozenRubric(gradingArgs),
  ]);

  const allTwo = [r1, r2];
  const readable = allTwo.filter((g) => g.readability === "readable");
  console.info(
    `[gradeSimple] Scores: ${allTwo.map((g) => g.total_score ?? "rejected").join(", ")} — readable=${readable.length}/2`,
  );

  // ── Rejected image ────────────────────────────────────────────────────────
  if (readable.length === 0) {
    return {
      readability: "rejected",
      rejection_reason: r1.rejection_reason,
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

  // Anchor per subpunct: media points_earned din run-urile readable, clamped la allocated_points
  const anchored = masterRubric.rubric_breakdown.map((rubricItem, idx) => {
    let earned = 0;
    let justification = "";
    for (const g of readable) {
      const ai = g.breakdown[idx];
      const clamped = ai ? Math.min(Math.max(0, ai.points_earned), rubricItem.allocated_points) : 0;
      if (clamped >= earned) {
        earned = clamped;
        justification = ai?.justification ?? justification;
      }
    }
    return {
      milestone_name: rubricItem.milestone_name,
      points_possible: rubricItem.allocated_points,
      points_earned: earned,
      justification,
    };
  });

  const puncteObtinute = Math.min(
    anchored.reduce((s, b) => s + b.points_earned, 0),
    totalBarem,
  );

  const puncteFort: string[] = [];
  const deImbunatatit: string[] = [];
  for (const item of anchored) {
    const fraction = item.points_possible > 0 ? item.points_earned / item.points_possible : 0;
    if (fraction >= 0.8 && item.points_earned > 0) {
      puncteFort.push(`${item.milestone_name}: ${item.justification}`);
    } else if (fraction < 0.5) {
      deImbunatatit.push(`${item.milestone_name}: ${item.justification}`);
    }
  }

  const criterii = anchored.map((b) => ({
    label: b.milestone_name,
    puncte_maxime: b.points_possible,
    puncte_obtinute: b.points_earned,
    ce_a_fost_corect: b.points_earned > 0 ? b.justification : "",
    ce_lipseste_sau_e_gresit: b.points_earned < b.points_possible ? b.justification : "",
  }));

  const feedbackParts = readable.flatMap((g) => [
    g.visual_feedback ? `Reprezentări vizuale: ${g.visual_feedback}` : "",
    g.reasoning_feedback ? `Raționament: ${g.reasoning_feedback}` : "",
  ]).filter((v, i, arr) => v && arr.indexOf(v) === i);

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

// ─── Subject page range detector ─────────────────────────────────────────────

const PageRangesSchema = z.object({
  subjects: z.array(z.object({
    number: z.number().int(),
    startPage: z.number().int(),
    endPage: z.number().int(),
  })),
});

export async function detectSubjectPageRanges(args: {
  rubricPdfBytes: Uint8Array;
  totalProblems: number;
}): Promise<Record<number, { startPage: number; endPage: number }>> {
  const gemini = getGeminiClient();
  const modelName = getGeminiRubricModel();

  const model = gemini.getGenerativeModel({
    model: modelName,
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          subjects: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                number: { type: SchemaType.INTEGER },
                startPage: { type: SchemaType.INTEGER },
                endPage: { type: SchemaType.INTEGER },
              },
              required: ["number", "startPage", "endPage"],
            },
          },
        },
        required: ["subjects"],
      },
    },
  });

  const prompt =
    `Acest PDF conține baremul unui concurs cu exact ${args.totalProblems} subiecte/probleme (numerotate Subiectul I, Subiectul II etc. sau Problema 1, 2 etc.). ` +
    `Identifică pe ce pagini (1-indexed) începe și se termină fiecare subiect. ` +
    `Un subiect poate să înceapă și să se termine pe aceeași pagină, sau să se întindă pe mai multe pagini. ` +
    `Returnează exact ${args.totalProblems} intrări, una pentru fiecare subiect.`;

  try {
    const result = await withRetry(() => model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: "application/pdf", data: toBase64(args.rubricPdfBytes) } },
    ]));
    const parsed = PageRangesSchema.safeParse(JSON.parse(result.response.text()));
    if (!parsed.success) return {};
    return Object.fromEntries(parsed.data.subjects.map((s) => [s.number, { startPage: s.startPage, endPage: s.endPage }]));
  } catch (err) {
    console.warn("[detectSubjectPageRanges] failed, continuing without page hints:", err instanceof Error ? err.message : err);
    return {};
  }
}

// ─── Unrelated content detector ──────────────────────────────────────────────

const UnrelatedDetectSchema = z.object({
  is_unrelated: z.boolean(),
});

export async function detectIsUnrelated(args: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<boolean> {
  const gemini = getGeminiClient();
  const modelName = getGeminiRubricModel();
  try {
    const model = gemini.getGenerativeModel({
      model: modelName,
      generationConfig: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: { is_unrelated: { type: SchemaType.BOOLEAN } },
          required: ["is_unrelated"],
        },
      },
    });
    const result = await withRetry(() => model.generateContent([
      {
        text: "Analizează imaginea. Răspunde cu is_unrelated: true dacă imaginea NU conține nicio rezolvare matematică, fizică sau chimie (de exemplu: este o fotografie aleatorie, un selfie, o imagine fără conținut academic, un desen fără legătură, text complet irelevant). Răspunde cu is_unrelated: false dacă imaginea conține orice fel de calcule, scheme, ecuații, demonstrații sau scriere academică — chiar și parțiale sau greșite.",
      },
      { inlineData: { mimeType: args.mimeType, data: toBase64(args.bytes) } },
    ]));
    const parsed = UnrelatedDetectSchema.safeParse(JSON.parse(result.response.text()));
    return parsed.success ? parsed.data.is_unrelated : false;
  } catch {
    return false;
  }
}

// ─── Barem detector ───────────────────────────────────────────────────────────

const BaremDetectSchema = z.object({
  is_barem: z.boolean(),
});

export async function detectIsBaremImage(args: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<boolean> {
  const gemini = getGeminiClient();
  const modelName = getGeminiRubricModel();
  try {
    const model = gemini.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: { is_barem: { type: SchemaType.BOOLEAN } },
          required: ["is_barem"],
        },
      },
    });
    const result = await withRetry(() => model.generateContent([
      {
        text: "Analizează imaginea. Răspunde cu is_barem: true dacă imaginea conține un barem oficial, schemă de notare, sau soluție model (cu punctaje explicite pe criterii), specific unui concurs sau olimpiadă. Răspunde cu is_barem: false dacă e o rezolvare scrisă de mână de un elev, chiar dacă conține calcule corecte.",
      },
      { inlineData: { mimeType: args.mimeType, data: toBase64(args.bytes) } },
    ]));
    const parsed = BaremDetectSchema.safeParse(JSON.parse(result.response.text()));
    return parsed.success ? parsed.data.is_barem : false;
  } catch {
    return false;
  }
}
