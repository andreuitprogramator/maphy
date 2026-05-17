import type { AiTeacherStyle, Problem, Submission } from "@prisma/client";
import { getTeacherStyleInstructions } from "@/lib/ai/teacher-style";

export const GRADING_SYSTEM_PROMPT_BASE = `
You are an olympiad math/physics grader for handwritten student submissions.
First determine readability. If image is unreadable/blurry, reject and do not grade.
If readable, grade strictly according to rubric and max score.
Allow mathematically/physically valid alternative reasoning even if it differs from official solution.
Do not award points for unsupported claims or missing justifications.
Return STRICT JSON only; no markdown, no extra text.
`.trim();

/** Full system message: base rules + teacher voice (tone only). */
export function buildGradingSystemPrompt(teacherStyle: AiTeacherStyle): string {
  return `${GRADING_SYSTEM_PROMPT_BASE}\n\n${getTeacherStyleInstructions(teacherStyle)}`;
}

/** @deprecated Use buildGradingSystemPrompt with a concrete AiTeacherStyle */
export const GRADING_SYSTEM_PROMPT = GRADING_SYSTEM_PROMPT_BASE;

export const GRADING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    readability: { type: "string", enum: ["readable", "rejected"] },
    reason: { type: ["string", "null"] },
    score: { type: ["number", "null"] },
    short_feedback: { type: ["string", "null"] },
    rubric_breakdown: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          points: { type: "number" },
          maxPoints: { type: "number" },
          notes: { type: "string" },
        },
        required: ["label", "points", "maxPoints", "notes"],
      },
    },
    detected_strengths: { type: "array", items: { type: "string" } },
    detected_mistakes: { type: "array", items: { type: "string" } },
    final_feedback: { type: ["string", "null"] },
    attempted_subparts: {
      type: "array",
      items: { type: "string", enum: ["A", "B", "C", "D", "E"] },
    },
  },
  required: [
    "readability",
    "reason",
    "score",
    "short_feedback",
    "rubric_breakdown",
    "detected_strengths",
    "detected_mistakes",
    "final_feedback",
    "attempted_subparts",
  ],
} as const;

export function buildGradingPrompt(args: {
  problem: Pick<Problem, "statement" | "officialSolution" | "gradingRubric" | "maxScore">;
  submission: Pick<Submission, "ocrExtractedText">;
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
}) {
  return `
Grade this handwritten olympiad submission.

${args.contestMeta ? `CONTEST SET CONTEXT (IMPORTANT):
- Contest set title: ${args.contestMeta.contestSetTitle}
- Competition: ${args.contestMeta.contestName}
- This submission targets only problem #${args.contestMeta.problemNumber}: ${args.contestMeta.problemTitle}
- Statement PDF URL: ${args.contestMeta.statementPdfUrl ?? "(none)"}
- Rubric PDF URL: ${args.contestMeta.rubricPdfUrl ?? "(none)"}
- Rubric PDF text extracted on server: ${args.contestMeta.rubricPdfExtractAvailable ? "yes" : "no"}
Server-side problem scoping:
- Dedicated statement images uploaded for this problem: ${args.contestMeta.hasProblemStatementImages ? "yes (use these)" : "no"}
- Dedicated rubric images uploaded for this problem: ${args.contestMeta.hasProblemRubricImages ? "yes (use these as authoritative barem)" : "no"}
- Statement section isolated from PDF text: ${args.contestMeta.usedStatementSectionIsolation ? "yes" : "no / fallback"}
- Rubric section isolated from PDF text: ${args.contestMeta.usedRubricSectionIsolation ? "yes" : "no / fallback"}
Attached inputs in this request:
- input_image = student's handwritten solution (primary evidence for awarded points).
- Additional input_image files may be attached for this problem only:
  - problem statement image(s) for this exact internal problem
  - rubric image(s) for this exact internal problem
Treat problem-specific rubric images as higher priority than generic contest-level text when they conflict.
Focus grading ONLY on this selected internal problem. Ignore unrelated problems from the same sheet.
If the student's work is for another subiect/problem, do not award those points here.
Never grade Subiectul/Problema II, III, etc. when current target is Subiectul/Problema I (and vice versa).
` : ""}

PROBLEM STATEMENT:
${args.problem.statement}

OFFICIAL SOLUTION:
${args.problem.officialSolution}

GRADING RUBRIC (must guide scoring):
${args.problem.gradingRubric}

MAX SCORE: ${args.problem.maxScore}

STRICT SCORING POLICY:
- Student evidence comes ONLY from the uploaded handwritten image (and optional OCR text). Never treat official solution/rubric text itself as proof the student solved a step.
- Rubric/barem images may show official answers, case diagrams (I, II, III), and point columns — those are for CRITERIA and WEIGHTS only. Seeing them in attachments does NOT mean the student earned those points.
- Do not write "cases were stated" or "structure I–III present" unless the STUDENT image clearly shows that handwriting/typing.
- Award points criterion-by-criterion, only when evidence exists in the student's uploaded work.
- Do NOT infer missing steps in favor of the student.
- Do NOT award full score unless every required rubric criterion is clearly satisfied.
- Never give MAX SCORE when any rubric criterion has partial/unclear evidence.
- If rubric text conflicts with generic expectations, rubric text wins.
- If evidence is ambiguous or missing, deduct points and explain briefly.
- Rubric breakdown labels must come from the provided rubric wording; do not invent new criteria.
- In each rubric_breakdown.notes, cite concrete student evidence (numbers, formulas, statements) OR explicitly state missing evidence.
- If a sub-part is missing from the student's solution, assign 0 points for that sub-part and mention it explicitly.
- If the student shows a formula, numeric substitution, or final result for a rubric step in their image, award proportional points for that step (do not require perfect wording).
- If you cite a numeric result from the student's work in notes (e.g. Δt ≈ 938 s), you MUST award corresponding points for that criterion; never list evidence in strengths and assign 0 on the same criterion.
- MULTI-PART RUBRIC (A, B, C, D, E, …) — mandatory:
  - Return attempted_subparts: only letters where the STUDENT IMAGE contains work for that item (heading "A." … "E." OR clearly separated content for that sub-problem, even without a letter).
  - Do NOT list a letter just because it appears in the rubric/statement PDF — only student handwriting/typing counts.
  - Do NOT list D or E if the student only did A–C (e.g. floating cube + ΔH + first table values) without experimental table processing, black-cube density, or variable-density liquid (y₁ₛ, d≈42.8 cm).
  - For D: require student work on the experimental table / ρ₂ / cases I–III — not just the barem diagram. If absent: attempted_subparts without D, points=0.
  - For E: require student work on variable-density liquid (y₁ₛ, d≈42.8 cm, etc.). If absent: no E in attempted_subparts, points=0.
  - In rubric_breakdown.notes for D/E, quote what the student wrote or start with "Neabordat:" — never describe barem content as if the student wrote it.
  - If a sub-part is not in attempted_subparts, its rubric row MUST have points=0 and notes starting with "Neabordat:".
  - If notes admit work is incomplete ("not fully shown", "missing", "not completely written"), points MUST be < maxPoints for that row.
  - Never assign points == maxPoints while notes list missing steps for that same row.
  - score must equal the sum of rubric_breakdown.points (before any server scaling).
  - When all barem steps for an attempted sub-part are clearly in the student image, award full maxPoints for that row only.
- Your rubric_breakdown.maxPoints must be on the same scale as MAX SCORE, and the sum of maxPoints across rubric_breakdown should equal MAX SCORE.
- Use neutral, proportional language. Only congratulate strongly if score == MAX SCORE. If score is low, be matter-of-fact and point to missing parts.
- Self-check before returning: if score == MAX SCORE, then every rubric row must have points == maxPoints and no missing-evidence statement.

OCR EXTRACTED TEXT (optional, may be noisy):
${args.submission.ocrExtractedText ?? "(none)"}

Return JSON with this shape:
- If unreadable:
  { "readability": "rejected", "reason": "...", "score": null, "short_feedback": null, "rubric_breakdown": [], "detected_strengths": [], "detected_mistakes": [], "final_feedback": null, "attempted_subparts": [] }
- If readable:
  {
    "readability": "readable",
    "score": 0-100,
    "reason": null,
    "short_feedback": "...",
    "rubric_breakdown": [{ "label": "...", "points": number, "maxPoints": number, "notes": "..." }],
    "detected_strengths": ["..."],
    "detected_mistakes": ["..."],
    "final_feedback": "...",
    "attempted_subparts": ["A"]
  }
`.trim();
}
