import OpenAI from "openai";
import type { Problem, Submission } from "@prisma/client";
import { getAiGradingModel, getOpenAiApiKey, modelSupportsTemperature } from "@/lib/ai/config";
import type { AiTeacherStyle } from "@prisma/client";
import {
  buildGradingPrompt,
  buildGradingSystemPrompt,
  GRADING_JSON_SCHEMA,
} from "@/lib/ai/prompts";
import { stripHtmlForPrompt } from "@/lib/html/strip";
import { GraderModelResultSchema, type GraderModelResult } from "@/lib/ai/types";

/**
 * Scans raw JSON string values and re-escapes any bare LaTeX backslashes that
 * would otherwise be misinterpreted as JSON escape sequences (e.g. \f → form-feed,
 * \t → tab, \a → invalid). After this pass JSON.parse produces the correct \frac,
 * \sin, \alpha etc. for KaTeX rendering.
 */
function fixLatexBackslashesInJson(raw: string): string {
  let result = "";
  let i = 0;
  let inString = false;

  while (i < raw.length) {
    const ch = raw[i];

    if (!inString) {
      result += ch;
      if (ch === '"') inString = true;
      i++;
      continue;
    }

    // Inside a JSON string value
    if (ch === '"') {
      result += ch;
      inString = false;
      i++;
      continue;
    }

    if (ch !== "\\") {
      result += ch;
      i++;
      continue;
    }

    // ch is a backslash
    const next = raw[i + 1] ?? "";

    if (next === '"' || next === "\\" || next === "/" || next === "n") {
      // Standard JSON escapes to preserve: \" \\ \/ \n
      result += ch + next;
      i += 2;
      continue;
    }

    if (next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
      // \uXXXX unicode escape — preserve as-is
      result += raw.slice(i, i + 6);
      i += 6;
      continue;
    }

    // \f \t \b \r or any unknown \X — fix to \\X so JSON.parse yields a literal backslash
    result += "\\\\" + next;
    i += 2;
  }

  return result;
}

function buildObservationPrompt(problemStatement: string): string {
  return `You are examining a student's handwritten solution for the following problem:

--- PROBLEM ---
${problemStatement}
--- END PROBLEM ---

Read the problem carefully to understand what each section (A, B, C, etc.) asks for.

Now look ONLY at the student's handwritten image. Do NOT use the expected answer — only describe what is physically written.

For EACH section of the problem (A, B, C, etc.), answer:
  - Did the student write anything specifically for this section? YES / NO / PARTIAL
  - If YES or PARTIAL: describe specifically what is written (diagram, equations, numbers, result).
  - If NO: state explicitly "Section [X]: NO WORK VISIBLE."

Also answer:
  - Is there a numerical derivation (formula with actual numbers substituted, e.g. "x = 12 / 4 = 3")? YES or NO. Note: listing given data at the top does NOT count.
  - Is there a final computed numeric result? Quote it if yes.

Be concrete and honest. If the student left a section completely blank, say so clearly.`;
}

const OBSERVATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    description: { type: "string" },
  },
  required: ["description"],
} as const;

async function observeStudentImage(
  imageBytes: Uint8Array,
  imageMimeType: string,
  problemStatement: string,
): Promise<string> {
  const client = getClient();
  const model = getAiGradingModel();
  try {
    const response = await client.chat.completions.create({
      model,
      ...(modelSupportsTemperature(model) ? { temperature: 0 } : {}),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildObservationPrompt(problemStatement) },
            { type: "image_url", image_url: { url: toDataUrl(imageBytes, imageMimeType), detail: "high" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "student_observation",
          schema: OBSERVATION_SCHEMA,
          strict: true,
        },
      },
    });
    const text = (response.choices[0].message.content ?? "").trim();
    const parsed = JSON.parse(text) as { description?: string };
    return parsed.description ?? "";
  } catch (err) {
    console.warn("[grader] observation pass failed, proceeding without it:", err);
    return "";
  }
}

const RUBRIC_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          maxPoints: { type: "number" },
        },
        required: ["label", "maxPoints"],
      },
    },
  },
  required: ["sections"],
} as const;

export async function extractRubricSectionsFromImages(
  images: Array<{ mimeType: string; bytes: Uint8Array }>,
): Promise<string> {
  if (images.length === 0) return "";
  const client = getClient();
  const model = getAiGradingModel();

  const prompt = `Analizează imaginea(ile) de barem și extrage TOATE criteriile de corectare.

Pentru fiecare criteriu, returnează eticheta completă (inclusiv litera/numărul subpunctului) și punctajul maxim.

Format JSON obligatoriu:
{
  "sections": [
    { "label": "a) Descriere criteriu", "maxPoints": 50 },
    { "label": "b) Descriere criteriu", "maxPoints": 50 }
  ]
}

Dacă nu poți identifica structura baremului, returnează: { "sections": [] }
Răspunde STRICT JSON, fără text suplimentar.`;

  try {
    const response = await client.chat.completions.create({
      model,
      ...(modelSupportsTemperature(model) ? { temperature: 0 } : {}),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: toDataUrl(img.bytes, img.mimeType), detail: "high" as const },
            })),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "rubric_extraction",
          schema: RUBRIC_EXTRACTION_SCHEMA,
          strict: true,
        },
      },
    });

    const text = (response.choices[0].message.content ?? "").trim();
    const parsed = JSON.parse(text) as { sections: Array<{ label: string; maxPoints: number }> };
    if (!parsed.sections?.length) return "";

    const total = parsed.sections.reduce((s, r) => s + (r.maxPoints || 0), 0);
    const lines = parsed.sections
      .map((s, i) => `Section ${i + 1}: ${s.label} — max ${s.maxPoints} points`)
      .join("\n\n");
    return `Rubric (max ${total} total) — apply all sections:\n\n${lines}`;
  } catch (err) {
    console.warn("[grader] rubric extraction from images failed:", err);
    return "";
  }
}

let cachedClient: OpenAI | null = null;

function getClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  return cachedClient;
}

function toDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}


export async function gradeWithOpenAi(args: {
  problem: Pick<Problem, "statement" | "officialSolution" | "gradingRubric" | "maxScore">;
  submission: Pick<Submission, "ocrExtractedText">;
  imageBytes: Uint8Array;
  imageMimeType: string;
  teacherStyle: AiTeacherStyle;
  extractedRubricText?: string;
  rawRubricTotal?: number;
  contestMeta?: {
    contestSetTitle: string;
    contestName: string;
    problemTitle: string;
    problemNumber: number;
    statementPdfUrl: string | null;
    rubricPdfUrl: string | null;
    rubricPdfExtractAvailable?: boolean;
    usedRubricSectionIsolation?: boolean;
    usedStatementSectionIsolation?: boolean;
    hasProblemStatementImages?: boolean;
    hasProblemRubricImages?: boolean;
  };
  supportingFiles?: Array<{
    filename: string;
    mimeType: string;
    bytes: Uint8Array;
  }>;
  supportingImages?: Array<{
    mimeType: string;
    bytes: Uint8Array;
  }>;
}): Promise<GraderModelResult> {
  const client = getClient();
  const model = getAiGradingModel();

  // Pass 1: observe student image with problem context (no barem/solution) to get a source-clean description.
  const priorObservation = await observeStudentImage(
    args.imageBytes,
    args.imageMimeType,
    stripHtmlForPrompt(args.problem.statement),
  );

  const prompt = buildGradingPrompt({
    problem: {
      ...args.problem,
      statement: stripHtmlForPrompt(args.problem.statement),
      officialSolution: stripHtmlForPrompt(args.problem.officialSolution),
    },
    submission: args.submission,
    priorObservation: priorObservation || undefined,
    contestMeta: args.contestMeta,
    extractedRubricText: args.extractedRubricText,
    rawRubricTotal: args.rawRubricTotal,
  });
  const imageDataUrl = toDataUrl(args.imageBytes, args.imageMimeType);
  const supportingImageItems =
    args.supportingImages?.map((img) => ({
      type: "image_url" as const,
      image_url: { url: toDataUrl(img.bytes, img.mimeType), detail: "high" as const },
    })) ?? [];

  const systemText = buildGradingSystemPrompt(args.teacherStyle);
  const response = await client.chat.completions.create({
    model,
    ...(modelSupportsTemperature(model) ? { temperature: 0 } : {}),
    messages: [
      {
        role: "system",
        content: systemText,
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...supportingImageItems,
          { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "maphy_grading_result",
        schema: GRADING_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const text = (response.choices[0].message.content ?? "").trim();
  if (!text) throw new Error("Model returned empty output");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fixLatexBackslashesInJson(text));
  } catch {
    throw new Error("Model returned non-JSON output");
  }

  const parsed = GraderModelResultSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Model JSON did not match grading schema");
  }

  return parsed.data;
}

