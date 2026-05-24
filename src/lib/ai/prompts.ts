import type { AiTeacherStyle, Problem, Submission } from "@prisma/client";
import { getTeacherStyleInstructions } from "@/lib/ai/teacher-style";
import { parseRubricSections } from "@/lib/problems/rubric-format";

// String.raw preserves backslash sequences literally so LaTeX examples survive
// JavaScript template-literal escape processing and reach the AI unchanged.
const _LATEX_JSON_RULE = String.raw`LANGUAGE & NOTATION RULES (mandatory):
- Write ALL text fields (short_feedback, final_feedback, rubric_breakdown[].notes, detected_strengths[], detected_mistakes[], reason) in ROMANIAN.
- Use LaTeX for all math. Wrap inline math in $...$, display math in $$...$$.
- JSON BACKSLASH RULE (critical): Your output is JSON. In JSON strings a literal backslash must be encoded as \\. Every LaTeX backslash must therefore be DOUBLED in your JSON output:
  WRITE IN JSON (correct):  $\\frac{a}{b}$   $\\alpha$   $\\mu$   $\\sin\\alpha + \\mu\\cos\\alpha$   $\\vec{F}$   $\\sqrt{x}$
  DO NOT WRITE (corrupts):  $\frac{a}{b}$   $\alpha$   $\sin$   — \f is form-feed and \t is tab in JSON
  Full JSON output example:  "$x = \\frac{a}{b + c}$"
- Powers ($x^{2}$), subscripts ($F_{1}$), and plain numbers need no backslash.
- APPROVED COMMANDS (use only these — others may not render):
  Greek: \\alpha \\beta \\gamma \\delta \\mu \\nu \\pi \\rho \\sigma \\tau \\phi \\omega \\Delta \\Sigma \\Omega
  Trig/log: \\sin \\cos \\tan \\cot \\arcsin \\arccos \\arctan \\log \\ln
  Structure: \\frac{a}{b}  \\sqrt{x}  \\vec{F}  \\hat{n}  \\overline{AB}
  Relations: \\leq \\geq \\neq \\approx \\equiv \\pm \\cdot \\times
  Degrees: $45^{\\circ}$ — use ^{\\circ} for the degree symbol, NOT \\degree or \\llb
  Arrows: \\rightarrow \\leftarrow \\Rightarrow
- Never write math in plain text; always use $...$.
- CRITICAL: Never insert line breaks (\\n) inside a $...$ expression. Keep every math expression on a single line.`;

export const GRADING_SYSTEM_PROMPT_BASE = [
  "You are an olympiad math/physics grader for handwritten student submissions.",
  "First determine readability. If image is unreadable/blurry, reject and do not grade.",
  "If readable, grade strictly according to rubric and max score.",
  "Allow mathematically/physically valid alternative reasoning even if it differs from official solution.",
  "Do not award points for unsupported claims or missing justifications.",
  "Return STRICT JSON only; no markdown, no extra text.",
  "",
  _LATEX_JSON_RULE,
].join("\n");

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
    student_image_observations: { type: "string" },
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
    "student_image_observations",
    "score",
    "short_feedback",
    "rubric_breakdown",
    "detected_strengths",
    "detected_mistakes",
    "final_feedback",
    "attempted_subparts",
  ],
} as const;

/**
 * Generează blocul de constrângere al baremului: lista fixă de criterii pe care
 * AI-ul trebuie să le returneze exact, fără adăugiri sau redenumiri.
 */
function buildRubricConstraintBlock(gradingRubric: string): string {
  const sections = parseRubricSections(gradingRubric);
  if (!sections || sections.length === 0) return "";

  const list = sections
    .map(
      (s, i) =>
        `  ${i + 1}. "${s.label}"${s.maxPoints > 0 ? ` — max ${s.maxPoints} puncte` : ""}`,
    )
    .join("\n");

  return `
STRUCTURA OBLIGATORIE A rubric_breakdown (non-negociabil):
Baremul are exact ${sections.length} criterii. rubric_breakdown TREBUIE să conțină EXACT ${sections.length} rânduri, în această ordine:
${list}
INTERZIS: nu adăuga criterii noi, nu redenumi, nu combina, nu omite niciun criteriu.
Acordă puncte NUMAI pentru criteriile de mai sus. Orice criteriu inventat în afara acestei liste va fi considerat eroare gravă.
Criteriile neabordate de elev primesc points=0 și notes începând cu "Neabordat:".`;
}

export function buildGradingPrompt(args: {
  problem: Pick<Problem, "statement" | "officialSolution" | "gradingRubric" | "maxScore">;
  submission: Pick<Submission, "ocrExtractedText">;
  /** Description of student work produced by a separate pass that saw only the student image — no barem. */
  priorObservation?: string;
  /** Rubric text extracted from rubric images via a vision pass; overrides gradingRubric for constraint injection. */
  extractedRubricText?: string;
  /** Suma totală a criteriilor din barem (scara brută). Când e furnizat, AI lucrează la această scară. */
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
${buildRubricConstraintBlock(args.extractedRubricText ?? args.problem.gradingRubric)}
MAX BAREM (suma exactă a criteriilor — lucrează la această scară, nu rescala): ${args.rawRubricTotal ?? args.problem.maxScore}

PRE-COMPUTED OBSERVATION OF STUDENT IMAGE (from a separate pass that saw ONLY the student image — no rubric, no barem, no official solution):
${args.priorObservation ? args.priorObservation : "(not available — use student_image_observations field instead)"}

HARD CONSTRAINTS from this observation — cannot be overridden by barem/rubric images:
- SECTION ABSENCE RULE (highest priority): If the observation says "Section [X]: NO WORK VISIBLE" or equivalent for any section letter, then EVERY rubric row for that section MUST have points=0 and notes starting with "Neabordat:". There are zero exceptions — not even if the barem image shows a full solution for that section, not even if the student's work for another section "could apply". The absence was detected before seeing the barem; it is ground truth.
- Any rubric criterion that requires numerical substitution/calculation: you may ONLY award points if the observation explicitly says "YES" to numerical derivation AND describes a specific substitution. Listing given parameters does NOT qualify.
- Any rubric criterion that requires a final computed result: you may ONLY award points if the observation explicitly states a final numeric result was written.
- If the observation says "no numerical substitution", "no final result", or "only symbolic equations visible" → all numerical/result criteria get 0 points, no exceptions.

STRICT SCORING POLICY:

SOURCE RULE — applies to every single point:
  The student's handwritten image is the ONLY valid source of evidence. Rubric/barem images and text show only CRITERIA and the official answer. A value in the barem does NOT mean the student wrote it.
  For each rubric row with points > 0, you must be able to point to something physically written in the student's image that satisfies that criterion.

BAREM ADMISSION RULE — automatic zero, no exceptions:
  If your own notes for a row use any phrase that admits the values came from the barem — e.g. "coincident cu barem", "valorile din barem", "conform baremului", "coincident cu zona rubricii", "după cum apare în barem/rubric", "valorile coincid cu" — then you are proving you read from the barem, not the student. Set that row to 0 points immediately and replace notes with "Neabordat: valorile au fost citite din barem, nu sunt vizibile în lucrarea studentului."

SCORE CALIBRATION:
  - score=0 is ONLY valid when the image is completely blank. If ANY correct work is visible, award proportional points.
  - score=MAX is ONLY valid when ALL criteria are clearly and visibly satisfied in the student image.
  - The NORMAL expected outcome is PARTIAL CREDIT: student did A correctly → award A; student left B blank → zero B. The correct score for "A done, B absent" is maxPoints(A), not 0 and not MAX.

NOTES FORMAT:
  - Non-zero rows: describe what the student actually wrote (formula, substitution, result).
  - Zero rows: start with "Neabordat:" and explain briefly.
  - Do NOT include phrases like "coincident cu barem" or "conform baremului" in notes for non-zero rows. If you feel the urge to write such a phrase, that section gets 0.

OTHER RULES:
  - Do NOT infer missing steps in favor of the student.
  - If a sub-part is not in attempted_subparts, its row MUST have points=0 and "Neabordat:" notes.
  - If notes admit incomplete work ("not fully shown", "missing", "lipsesc"), points MUST be < maxPoints for that row.
  - Never points == maxPoints when notes list missing steps for the same row.
  - Accept results within 5% of the expected value due to rounding.
  - Rubric breakdown labels come from the rubric wording only.
  - If you cite a numeric result in notes, you MUST award corresponding points for that row.

RUBRIC STRUCTURE — non-negotiable:
  - One row per distinct rubric section. Never merge, NEVER OMIT any section.
  - TOATE criteriile din barem trebuie să apară în rubric_breakdown, inclusiv cele neabordate.
  - Criteriile neabordate primesc points=0 și notes începând cu "Neabordat:". Nu le elimina din output.
  - SCALA EXACTĂ: Folosește scara baremului exact. sum(rubric_breakdown[].maxPoints) TREBUIE să fie egal cu totalul criteriilor din barem. NU rescala la MAX SCORE — lucrează la scara baremului.
  - score MUST equal the exact sum of rubric_breakdown[].points.
  - If any row has points < maxPoints, score cannot equal MAX SCORE.
  - INTERZIS: nu returna doar criteriile pe care elevul le-a rezolvat. Returnează TOATE criteriile, cu 0 pentru cele lipsă.

MULTI-PART RUBRIC (A, B, C, D, E):
  - attempted_subparts: only letters where STUDENT IMAGE contains visible work.
  - Do NOT list a letter because it appears in rubric/statement — only student handwriting counts.
  - If not in attempted_subparts → row for that letter MUST exist în rubric_breakdown cu points=0 și notes="Neabordat: sub-punctul nu apare în lucrarea elevului."
  - When all barem steps for an attempted sub-part are clearly visible in the student image, award full maxPoints for that row only.

MANDATORY SELF-CHECK — run in order before returning:
  1. Count rubric sections → rubric_breakdown must have exactly that many rows.
  2. Sum maxPoints → must equal totalul criteriilor din barem. Dacă suma diferă față de barem, corectează fără a rescala la MAX SCORE.
  3. Sum points → set score to this sum. Fix if different.
  4. NOTES ADMISSION SCAN: Read every row's notes. Any row containing phrases like "coincident cu barem", "zona rubricii", "conform baremului", "valorile din barem", "coincid cu" → set points to 0, replace notes with "Neabordat: valorile au fost citite din barem.", recompute score.
  5. SECTION ABSENCE CHECK: For each section letter (A, B, C, …) in the rubric, check the PRE-COMPUTED OBSERVATION. If the observation says "NO WORK VISIBLE" for that section → set ALL rows for that section to 0 points and "Neabordat:" notes, recompute score. This overrides everything else.
  6. CONSISTENCY CHECK: For every remaining non-zero row, does the PRE-COMPUTED OBSERVATION explicitly describe visible student work matching that criterion? If not → set that row to 0, recompute score.
  7. FEEDBACK CONTRADICTION CHECK: If short_feedback or final_feedback contains "parțial", "incompletă", "lipsesc detalii", "nu există detalii complete", or similar → score CANNOT equal MAX SCORE. Lower it proportionally.
  8. ARITHMETIC FINAL CHECK: If score == MAX SCORE but any row has points < maxPoints → arithmetic error, fix it. If score < MAX SCORE but all rows have points == maxPoints → arithmetic error, fix it.

OCR EXTRACTED TEXT (optional, may be noisy):
${args.submission.ocrExtractedText ?? "(none)"}

REMINDER: All text in Romanian. ALL math expressions MUST be wrapped in $...$. JSON BACKSLASH RULE: double every LaTeX backslash (\\frac, \\alpha, \\sin, \\mu, \\vec, \\sqrt, etc.).
REMINDER: Un rând în rubric_breakdown per criteriu din barem — INCLUSIV criteriile cu 0 puncte. score = suma exactă a points. Rulează cele 8 verificări înainte de a returna.
REMINDER: Barem images = official answer only. Never cite barem values as student evidence.
REMINDER: "coincident cu barem" or any barem-admission phrase in notes → that row gets 0, automatically. No exceptions.
REMINDER: score=0 only for blank pages. score=MAX only when ALL criteria visibly satisfied. Partial work → partial score.

Return JSON with this shape:
- If unreadable:
  { "readability": "rejected", "student_image_observations": "image is unreadable", "reason": "...", "score": null, "short_feedback": null, "rubric_breakdown": [], "detected_strengths": [], "detected_mistakes": [], "final_feedback": null, "attempted_subparts": [] }
- If readable:
  {
    "readability": "readable",
    "student_image_observations": "what you see in the student image only",
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
