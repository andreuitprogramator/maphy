import OpenAI from "openai";
import type { Problem, Submission } from "@prisma/client";
import { getAiGradingModel, getOpenAiApiKey } from "@/lib/ai/config";
import type { AiTeacherStyle } from "@prisma/client";
import {
  buildGradingPrompt,
  buildGradingSystemPrompt,
  GRADING_JSON_SCHEMA,
} from "@/lib/ai/prompts";
import { stripHtmlForPrompt } from "@/lib/html/strip";
import { GraderModelResultSchema, type GraderModelResult } from "@/lib/ai/types";

let cachedClient: OpenAI | null = null;

function getClient() {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  return cachedClient;
}

function toDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function extractText(response: OpenAI.Responses.Response) {
  return response.output_text || "";
}

export async function gradeWithOpenAi(args: {
  problem: Pick<Problem, "statement" | "officialSolution" | "gradingRubric" | "maxScore">;
  submission: Pick<Submission, "ocrExtractedText">;
  imageBytes: Uint8Array;
  imageMimeType: string;
  teacherStyle: AiTeacherStyle;
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
  const prompt = buildGradingPrompt({
    problem: {
      ...args.problem,
      statement: stripHtmlForPrompt(args.problem.statement),
      officialSolution: stripHtmlForPrompt(args.problem.officialSolution),
    },
    submission: args.submission,
    contestMeta: args.contestMeta,
  });
  const imageDataUrl = toDataUrl(args.imageBytes, args.imageMimeType);
  const fileContentItems =
    args.supportingFiles?.map((f) => ({
      type: "input_file" as const,
      filename: f.filename,
      file_data: `data:${f.mimeType};base64,${Buffer.from(f.bytes).toString("base64")}`,
    })) ?? [];
  const supportingImageItems =
    args.supportingImages?.map((img) => ({
      type: "input_image" as const,
      image_url: toDataUrl(img.bytes, img.mimeType),
      detail: "high" as const,
    })) ?? [];

  const systemText = buildGradingSystemPrompt(args.teacherStyle);
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemText }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...supportingImageItems,
          ...fileContentItems,
          { type: "input_image", image_url: imageDataUrl, detail: "high" },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "maphy_grading_result",
        schema: GRADING_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const text = extractText(response).trim();
  if (!text) throw new Error("Model returned empty output");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error("Model returned non-JSON output");
  }

  const parsed = GraderModelResultSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Model JSON did not match grading schema");
  }

  return parsed.data;
}

