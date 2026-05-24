import { prisma } from "@/lib/db/prisma";
import { notifyFollowersOfSubmission } from "@/lib/notifications/service";
import { gradeWithOpenAi, extractRubricSectionsFromImages } from "@/lib/ai/grader";
import {
  gradeSimpleWithOpenAi,
  generateMasterRubric,
  validateSimpleResult,
  computeSimpleScore,
  type MasterRubric,
} from "@/lib/ai/grader-simple";
import { AiTeacherStyle, Prisma } from "@prisma/client";
import { readFile } from "fs/promises";
import path from "path";
import { extractPdfTextFromPublicUrl } from "@/lib/pdf/extract-text";
import type { GraderModelResult } from "@/lib/ai/types";
import { parseRubricSections } from "@/lib/problems/rubric-format";

function imageUrlToDiskPath(imageUrl: string) {
  const clean = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
  return path.join(process.cwd(), "public", ...clean.split("/"));
}

function publicUrlToDiskPath(publicUrl: string) {
  const clean = publicUrl.startsWith("/") ? publicUrl.slice(1) : publicUrl;
  return path.join(process.cwd(), "public", ...clean.split("/"));
}

function detectMimeType(bytes: Uint8Array) {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  if (isPng) return "image/png";
  if (isJpeg) return "image/jpeg";
  if (isWebp) return "image/webp";
  return "application/octet-stream";
}

function clampScore(score: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, Math.round(score)));
}

/**
 * Rotunjește un scor procentual la o valoare "frumoasă" din lista [50, 75, 90, 100]
 * dacă diferența este ≤ 1.5 puncte procentuale. Altfel returnează rotunjit simplu.
 */
export function prettifyDisplayScore(raw: number): number {
  const NICE_SCORES = [50, 75, 90, 100] as const;
  for (const nice of NICE_SCORES) {
    if (raw < nice && nice - raw <= 1.5) return nice;
  }
  return Math.round(raw);
}

// PostgreSQL UTF8 respinge null bytes (0x00). Le eliminăm din orice text primit de la AI.
function sanitizeForDb(s: string | null | undefined): string | null {
  if (s == null) return null;
  return s.replace(/\x00/g, "");
}

function sanitizeObjectForDb<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj).replace(/\\u0000/g, "")) as T;
}

function sumBreakdownPoints(rows: { points: number }[]) {
  return rows.reduce((s, r) => s + (Number.isFinite(r.points) ? r.points : 0), 0);
}

function sumBreakdownMaxPoints(rows: { maxPoints: number }[]) {
  return rows.reduce((s, r) => s + (Number.isFinite(r.maxPoints) ? r.maxPoints : 0), 0);
}

type RubricRow = { label: string; points: number; maxPoints: number; notes: string };

/**
 * Rescalează rândurile AI astfel încât sum(maxPoints) = maxScore.
 * Necesară când AI-ul returnează maxPoints pe altă scară (e.g. /50 în loc de /100).
 * Nota: proporționalizarea punctelor față de scara originală AI este
 * responsabilitatea reconcileWithRubricSections, nu a acestei funcții.
 */
function normalizeRubricBreakdownScale(rows: RubricRow[], maxScore: number): RubricRow[] {
  if (rows.length === 0 || maxScore <= 0) return rows;
  const totalMax = sumBreakdownMaxPoints(rows);
  if (totalMax <= 0) return rows;
  if (totalMax === maxScore)
    return rows.map((r) => ({ ...r, points: Math.max(0, Math.min(r.points, r.maxPoints)) }));

  const factor = maxScore / totalMax;
  const totalEarned = sumBreakdownPoints(rows);

  let scaled: RubricRow[] = rows.map((r) => ({
    ...r,
    maxPoints: Math.max(1, Math.round(r.maxPoints * factor)),
  }));

  // Corectează eroarea de rotunjire pentru ca sum(maxPoints) să fie exact maxScore.
  const diff = maxScore - sumBreakdownMaxPoints(scaled);
  if (diff !== 0) {
    const last = scaled.length - 1;
    scaled = scaled.map((r, i) =>
      i === last ? { ...r, maxPoints: Math.max(1, r.maxPoints + diff) } : r,
    );
  }

  // Proporțional: cât % din maxPoints-ul AI a câștigat elevul → aplicăm același % pe noile maxPoints.
  // Garda min(fractionPoints, src.points) previne supra-acordarea când fracția e mică (e.g. 2/50 = 4%).
  return scaled.map((r, i) => {
    const src = rows[i]!;
    const fraction = src.maxPoints > 0 ? Math.max(0, Math.min(1, src.points / src.maxPoints)) : 0;
    const fractionPoints = r.maxPoints > 0 ? Math.round(fraction * r.maxPoints) : 0;
    return { ...r, points: Math.max(0, Math.min(fractionPoints, src.points)) };
  });
}

/**
 * Elimină rânduri duplicate (același label, case-insensitive).
 * Punctele rândurilor duplicate se sumează, limitate la maxPoints.
 */
function deduplicateRubricRows(rows: RubricRow[]): RubricRow[] {
  const seen = new Map<string, number>();
  const result: RubricRow[] = [];
  for (const row of rows) {
    const key = row.label.trim().toLowerCase();
    if (seen.has(key)) {
      const idx = seen.get(key)!;
      result[idx] = {
        ...result[idx]!,
        points: Math.min(result[idx]!.maxPoints, result[idx]!.points + row.points),
      };
    } else {
      seen.set(key, result.length);
      result.push({ ...row });
    }
  }
  return result;
}

type ValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Verifică că rândurile finale sunt valide și că suma maxPoints ≈ expectedSumMax.
 * Acceptă o toleranță de 0.01 pentru bareme cu puncte float.
 */
function validateFinalRubricRows(rows: RubricRow[], expectedSumMax: number): ValidationResult {
  if (rows.length === 0) return { valid: false, reason: "rubric_breakdown gol" };
  for (const r of rows) {
    if (!Number.isFinite(r.points) || r.points < 0)
      return { valid: false, reason: `points invalid pentru "${r.label}"` };
    if (!Number.isFinite(r.maxPoints) || r.maxPoints <= 0)
      return { valid: false, reason: `maxPoints invalid pentru "${r.label}"` };
    if (r.points > r.maxPoints + 0.01)
      return { valid: false, reason: `points > maxPoints pentru "${r.label}"` };
  }
  // Duplicate labels interzise — indică criterii inventate sau reconciliere greșită.
  const labelsSeen = new Set<string>();
  for (const r of rows) {
    const key = r.label.trim().toLowerCase();
    if (labelsSeen.has(key))
      return { valid: false, reason: `label duplicat în rubric_breakdown: "${r.label}"` };
    labelsSeen.add(key);
  }
  const sumMax = sumBreakdownMaxPoints(rows);
  if (Math.abs(sumMax - expectedSumMax) > 0.01)
    return { valid: false, reason: `sum(maxPoints)=${sumMax} ≠ expected=${expectedSumMax}` };
  return { valid: true };
}

function scopeBreakdownToProblem(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
  problemNumber?: number,
) {
  if (!problemNumber) return rows;
  const targetRoman = romanFor(problemNumber);
  const otherMarkers = Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => n !== problemNumber);
  const mentionsOtherProblem = (text: string) =>
    otherMarkers.some((n) => {
      const rn = romanFor(n);
      return (
        new RegExp(`\\bsubiect(?:ul)?\\s+${n}\\b`, "i").test(text) ||
        new RegExp(`\\bsubiect(?:ul)?\\s+${rn}\\b`, "i").test(text) ||
        new RegExp(`\\bproblema\\s+${n}\\b`, "i").test(text) ||
        new RegExp(`\\bproblem\\s+${n}\\b`, "i").test(text)
      );
    });
  const mentionsTarget = (text: string) =>
    new RegExp(`\\bsubiect(?:ul)?\\s+${problemNumber}\\b`, "i").test(text) ||
    new RegExp(`\\bsubiect(?:ul)?\\s+${targetRoman}\\b`, "i").test(text) ||
    new RegExp(`\\bproblema\\s+${problemNumber}\\b`, "i").test(text) ||
    new RegExp(`\\bproblem\\s+${problemNumber}\\b`, "i").test(text);

  const filtered = rows.filter((r) => {
    const hay = `${r.label}\n${r.notes}`;
    if (mentionsOtherProblem(hay)) return false;
    return true;
  });

  // If model provided explicit target markers, keep those; otherwise keep neutral A/B/C-like rows.
  const explicitlyTargeted = filtered.filter((r) => mentionsTarget(`${r.label}\n${r.notes}`));
  return explicitlyTargeted.length > 0 ? explicitlyTargeted : filtered;
}

const SUBPART_LETTERS = ["A", "B", "C", "D", "E"] as const;
type SubPartLetter = (typeof SUBPART_LETTERS)[number];

function parseSubPartLetter(label: string): SubPartLetter | null {
  const m = label.trim().match(/^([A-E])\b/i);
  if (!m) return null;
  return m[1]!.toUpperCase() as SubPartLetter;
}

function isSubPartLetter(value: string): value is SubPartLetter {
  return SUBPART_LETTERS.includes(value as SubPartLetter);
}

function breakdownUsesSubParts(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
): boolean {
  const letters = rows.map((r) => parseSubPartLetter(r.label)).filter(Boolean);
  return new Set(letters).size >= 2;
}

function detectAttemptedSubPartsFromOcr(ocr: string | null | undefined): Set<SubPartLetter> {
  const found = new Set<SubPartLetter>();
  if (!ocr?.trim()) return found;
  for (const letter of SUBPART_LETTERS) {
    if (new RegExp(`\\b${letter}[\\.\\):]`, "i").test(ocr)) found.add(letter);
  }
  return found;
}

function normalizeAttemptedSubParts(input: string[] | undefined): Set<SubPartLetter> {
  const out = new Set<SubPartLetter>();
  for (const raw of input ?? []) {
    const letter = raw.trim().toUpperCase();
    if (isSubPartLetter(letter)) out.add(letter);
  }
  return out;
}

/**
 * Prefer model-reported parts. OCR often misses typed work without "A." headers;
 * only use OCR to drop D/E when the student image clearly has no such section.
 */
function resolveAttemptedSubParts(
  modelAttempted: string[] | undefined,
  ocr: string | null | undefined,
): Set<SubPartLetter> {
  const fromModel = normalizeAttemptedSubParts(modelAttempted);
  const fromOcr = detectAttemptedSubPartsFromOcr(ocr);

  if (fromModel.size === 0) return fromOcr;

  const result = new Set(fromModel);
  if (fromOcr.size > 0) {
    for (const letter of ["D", "E"] as const) {
      if (result.has(letter) && !fromOcr.has(letter)) result.delete(letter);
    }
  }
  return result;
}

function notesIndicateIncompleteWork(notes: string): boolean {
  const n = normalizeTextForMatch(notes);
  return (
    /\bnot fully\b/.test(n) ||
    /\bnot completely\b/.test(n) ||
    /\bnot completely written\b/.test(n) ||
    /\bnu este complet\b/.test(n) ||
    /\blipsesc\b/.test(n) ||
    /\blacks\b/.test(n) ||
    /\bpartial\b/.test(n) ||
    /\binsuficient\b/.test(n) ||
    /\bmissing\b/.test(n)
  );
}

/** Model cites barem answers for D/E while admitting the student did not show that work. */
function notesIndicateBaremHallucinationForSubPart(letter: SubPartLetter, notes: string): boolean {
  if (letter !== "D" && letter !== "E") return false;
  if (!notesIndicateIncompleteWork(notes)) return false;
  const n = normalizeTextForMatch(notes);
  if (letter === "E") {
    return /\b43[,.]?5\b/.test(n) || /\b42[,.]?8\b/.test(n) || /\by\s*1s\b/.test(n) || /\by\s*2s\b/.test(n);
  }
  return /\bcaz\b/.test(n) || /\btabel\b/.test(n) || /\bcase\s*(i{1,3}|1|2|3)\b/.test(n);
}

function refineAttemptedFromRowNotes(
  attempted: Set<SubPartLetter>,
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
): Set<SubPartLetter> {
  const refined = new Set(attempted);
  for (const r of rows) {
    const letter = parseSubPartLetter(r.label);
    if (!letter) continue;
    if (
      notesIndicateSubPartNotAttempted(r.notes) ||
      notesIndicateBaremHallucinationForSubPart(letter, r.notes)
    ) {
      refined.delete(letter);
    }
  }
  return refined;
}

const STUDENT_WORK_MARKERS: Partial<Record<SubPartLetter, RegExp[]>> = {
  A: [/\b514[,.]?\d/, /\bfa\s*=\s*g\b/],
  B: [/\bdelta\s*h\b/, /\b7\s*mm\b/],
  C: [/\brho\s*1\s*>\s*rho\s*0/, /\bl_2\s*=\s*l\b/, /\bprioritat/],
  // D/E need distinctive work — not merely "cases exist" in the barem
  D: [/\brho\s*2\b/, /\b0[,.]86\b/, /\bd\s*=\s*h\b/, /\beroare\b/, /\btabel\b.*\bd\b/],
  E: [/\by\s*1s\b/, /\by\s*2s\b/, /\b43[,.]?5\b/, /\b42[,.]?8\b/, /\bkl\b/, /\blichid\s+variabil\b/],
};

function notesExplicitlyCiteStudent(notes: string): boolean {
  return /\b(elev|elevul|student|student'?s|in lucrare|in imagine|in fotografie|scrie|a scris|handwriting|typed)\b/i.test(
    notes,
  );
}

/** Model claims sub-part content exists without tying it to the student image. */
function modelNotesHallucinateSubPartWork(letter: SubPartLetter, notes: string): boolean {
  if (letter !== "D" && letter !== "E") return false;
  const n = normalizeTextForMatch(notes);
  const claimsPresent =
    /\bwere stated\b/.test(n) ||
    /\bstructure of type\b/.test(n) ||
    /\bsunt prezentate\b/.test(n) ||
    /\bcases were\b/.test(n) ||
    /\btrei cazuri\b/.test(n) ||
    (/\bcaz\b/.test(n) && /\b(i{1,3}|1|2|3)\b/.test(n) && !notesExplicitlyCiteStudent(notes));
  return claimsPresent && !notesExplicitlyCiteStudent(notes);
}

function hasStudentEvidenceForSubPart(
  letter: SubPartLetter,
  ocr: string | null | undefined,
  row?: { notes: string },
): boolean {
  const markers = STUDENT_WORK_MARKERS[letter] ?? [];
  const ocrHay = ocr ?? "";
  if (markers.length > 0 && markers.some((p) => p.test(ocrHay))) return true;

  const notesHay = row?.notes ?? "";
  if (letter === "D" || letter === "E") {
    if (modelNotesHallucinateSubPartWork(letter, notesHay)) return false;
    if (!notesExplicitlyCiteStudent(notesHay)) return false;
    return markers.some((p) => p.test(notesHay));
  }

  const combined = `${ocrHay}\n${notesHay}`;
  return markers.some((p) => p.test(combined)) || notesCiteStudentWork(notesHay);
}

function restrictAttemptedToStudentEvidence(
  attempted: Set<SubPartLetter>,
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
  ocr: string | null | undefined,
): Set<SubPartLetter> {
  const restricted = new Set<SubPartLetter>();
  for (const letter of attempted) {
    const row = rows.find((r) => parseSubPartLetter(r.label) === letter);
    if (hasStudentEvidenceForSubPart(letter, ocr, row)) restricted.add(letter);
  }
  return restricted.size > 0 ? restricted : attempted;
}

function inferAttemptedFromStudentMarkers(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
): Set<SubPartLetter> {
  const inferred = new Set<SubPartLetter>();
  for (const r of rows) {
    const letter = parseSubPartLetter(r.label);
    if (!letter || (letter !== "A" && letter !== "B" && letter !== "C")) continue;
    const hay = `${r.label}\n${r.notes}`;
    const patterns = STUDENT_WORK_MARKERS[letter] ?? [];
    if (patterns.some((p) => p.test(hay))) inferred.add(letter);
  }
  return inferred;
}

function finalizeAttemptedSubParts(
  modelAttempted: string[] | undefined,
  ocr: string | null | undefined,
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
): Set<SubPartLetter> {
  let attempted = resolveAttemptedSubParts(modelAttempted, ocr);
  attempted = refineAttemptedFromRowNotes(attempted, rows);
  attempted = restrictAttemptedToStudentEvidence(attempted, rows, ocr);
  if (attempted.size === 0) {
    const inferred = inferAttemptedFromStudentMarkers(rows);
    if (inferred.size > 0) attempted = inferred;
  }
  return attempted;
}

function applyNotesPointsConsistency(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
  ocr: string | null | undefined,
): Array<{ label: string; points: number; maxPoints: number; notes: string }> {
  return rows.map((r) => {
    const letter = parseSubPartLetter(r.label);
    let points = r.points;

    if (letter && notesIndicateBaremHallucinationForSubPart(letter, r.notes)) {
      return {
        ...r,
        points: 0,
        notes: "Neabordat: valorile sau cazurile citate provin din barem, nu din lucrarea elevului.",
      };
    }

    if (
      letter &&
      (letter === "D" || letter === "E") &&
      points > 0 &&
      (modelNotesHallucinateSubPartWork(letter, r.notes) ||
        !hasStudentEvidenceForSubPart(letter, ocr, r))
    ) {
      return {
        ...r,
        points: 0,
        notes: "Neabordat: nu există în lucrarea elevului rezolvare pentru acest sub-punct (doar în barem/enunț).",
      };
    }

    if (points >= r.maxPoints && notesIndicateIncompleteWork(r.notes)) {
      points = Math.max(0, Math.floor(r.maxPoints * 0.5));
    }

    return { ...r, points: Math.min(points, r.maxPoints) };
  });
}

function notesIndicateSubPartNotAttempted(notes: string): boolean {
  const n = normalizeTextForMatch(notes);
  return (
    /\bneabordat\b/.test(n) ||
    /\bnot attempted\b/.test(n) ||
    /\bnu apare\b/.test(n) ||
    /\blipsa\b.{0,20}\bsectiunii\b/.test(n) ||
    /\bfara\b.{0,20}\bsectiune\b/.test(n)
  );
}

/** Model often mis-tags part-A calorimetry (Δt, Q_util, Q1–Q4) as B/C. */
function notesLookLikePartAWorkOnly(notes: string): boolean {
  const n = normalizeTextForMatch(notes);
  const hasPartAFinal =
    /\b938[,.]?\d*\b/.test(n) ||
    (/\bdelta\s*t\b/.test(n) && /\b40\b/.test(n)) ||
    (/\bq\s*util\b/.test(n) && /\bdelta\s*t\b/.test(n));
  const lacksPartBMarkers = !/\bmetanol\b/.test(n) && !/\bechilibr/.test(n) && !/\bamestec\b/.test(n);
  const lacksPartCMarkers =
    !/\b88\b/.test(n) && !/\b80\s*s\b/.test(n) && !/\bgrafic\b/.test(n) && !/\bc\s*\(\s*t\s*\)/.test(n);
  return hasPartAFinal && lacksPartBMarkers && lacksPartCMarkers;
}

function notesMisattributePartBC(notes: string): boolean {
  const n = normalizeTextForMatch(notes);
  if (notesLookLikePartAWorkOnly(notes)) return true;
  return /\bq\s*[1234]\b/.test(n) && /\btheta\b/.test(n) && !/\bmetanol\b/.test(n) && !/\bechilibr/.test(n);
}

function applySubPartAttemptGuards(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
  attempted: Set<SubPartLetter>,
): Array<{ label: string; points: number; maxPoints: number; notes: string }> {
  if (!breakdownUsesSubParts(rows) || attempted.size === 0) return rows;

  return rows.map((r) => {
    const letter = parseSubPartLetter(r.label);
    if (!letter) return r;

    if (letter === "B" && notesMisattributePartBC(r.notes)) {
      return {
        ...r,
        points: 0,
        notes: "Neabordat: valorile citate (Q1–Q4, θ, Δt) aparțin rezolvării la A, nu există secțiunea B în lucrare.",
      };
    }
    if (letter === "C" && notesLookLikePartAWorkOnly(r.notes)) {
      return {
        ...r,
        points: 0,
        notes: "Neabordat: nu există rezolvare pentru sub-punctul C (cald specific variabil / 88°C); conținutul este din A.",
      };
    }

    if (notesIndicateSubPartNotAttempted(r.notes)) {
      return {
        ...r,
        points: 0,
        notes: r.notes.trim() || "Neabordat: sub-punctul nu apare în lucrarea elevului.",
      };
    }

    if (!attempted.has(letter)) {
      return {
        ...r,
        points: 0,
        notes: "Neabordat: elevul nu a trimis rezolvare pentru acest sub-punct (A/B/C).",
      };
    }

    return r;
  });
}

function notesCiteStudentWork(notes: string): boolean {
  // If notes quote numbers/formulas from the page, do not treat as "missing evidence".
  return /\d/.test(notes) || /[=≈~]/.test(notes) || /\b(formula|ecua|rezultat|obtine|calcul)\b/i.test(notes);
}

function notesSuggestMissingEvidence(notes: string): boolean {
  if (notesCiteStudentWork(notes)) return false;
  const n = (notes ?? "").toLowerCase();
  return (
    /\blipse(?:ște|sc)\b/.test(n) ||
    /\b(lipsa|lipsesc)\b/.test(n) ||
    /\bnu exista\b/.test(n) ||
    /\bnu este\b.{0,20}\b(prezent|vizibil|inclus)\b/.test(n) ||
    /\bneclar\b/.test(n) ||
    /\binsuficient\b/.test(n) ||
    /\bmissing\b/.test(n) ||
    /\bno evidence\b/.test(n) ||
    /\bunclear\b/.test(n) ||
    /\bno evidence in the student\b/.test(n)
  );
}

/**
 * Ultimă linie de apărare: dacă modelul a scris "Neabordat:" în note dar a lăsat
 * puncte > 0 (inconsistență internă), forțăm 0. Aceasta se aplică mereu, indiferent
 * de alte garduri.
 */
function enforceNeabordatZeros(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
): Array<{ label: string; points: number; maxPoints: number; notes: string }> {
  return rows.map((r) => {
    if (r.points > 0 && notesIndicateSubPartNotAttempted(r.notes)) {
      return { ...r, points: 0 };
    }
    return r;
  });
}

function applyDeterministicEvidencePenalties(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
) {
  return rows.map((r) => {
    if (!Number.isFinite(r.points) || !Number.isFinite(r.maxPoints)) return r;
    if (r.maxPoints <= 0) return { ...r, points: 0 };
    if (!notesSuggestMissingEvidence(r.notes)) return r;
    if (notesCiteStudentWork(r.notes)) {
      return { ...r, points: Math.min(r.points, Math.max(0, Math.floor(r.maxPoints * 0.5))) };
    }
    return { ...r, points: 0 };
  });
}

function normalizeTextForMatch(input: string): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(input: string, minLen = 4): Set<string> {
  const normalized = normalizeTextForMatch(input);
  return new Set(
    normalized
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t.length >= minLen),
  );
}

function countOverlap(tokens: Set<string>, haystack: Set<string>): number {
  let n = 0;
  for (const t of tokens) if (haystack.has(t)) n += 1;
  return n;
}

function applyRubricAndEvidenceGuards(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
  gradingRubric: string,
  ocrExtractedText: string | null | undefined,
  opts?: { skipLabelRubricAnchor?: boolean },
) {
  const rubricTokens = tokenSet(gradingRubric, 4);
  const ocrTokens = tokenSet(ocrExtractedText ?? "", 3);
  const hasUsefulOcr = ocrTokens.size >= 20;

  let invalidRubricRows = 0;
  let weakEvidenceRows = 0;

  const guarded = rows.map((r) => {
    let points = r.points;
    const labelTokens = tokenSet(r.label, 4);
    const notesTokens = tokenSet(r.notes, 3);

    const sectionLabel =
      /^[a-e]\b/i.test(r.label.trim()) || /^[a-e][\.\)]/i.test(r.label.trim());
    const labelAnchoredToRubric =
      opts?.skipLabelRubricAnchor ||
      sectionLabel ||
      rubricTokens.size < 8 ||
      labelTokens.size === 0 ||
      countOverlap(labelTokens, rubricTokens) >= Math.min(2, labelTokens.size);
    if (!labelAnchoredToRubric) {
      invalidRubricRows += 1;
      points = Math.min(points, Math.floor(r.maxPoints * 0.5));
    }

    const looksLikeRubricLeak =
      /\b(conform barem|din barem|in barem|official solution|solutia oficiala)\b/i.test(r.notes);
    if (looksLikeRubricLeak && points > 0) {
      weakEvidenceRows += 1;
      points = Math.min(points, Math.floor(r.maxPoints * 0.3));
    }

    if (hasUsefulOcr && notesTokens.size >= 3 && !notesSuggestMissingEvidence(r.notes)) {
      const overlap = countOverlap(notesTokens, ocrTokens);
      if (overlap === 0 && points > 0) {
        weakEvidenceRows += 1;
        points = Math.min(points, Math.floor(r.maxPoints * 0.4));
      }
    }

    return { ...r, points: Math.max(0, Math.min(points, r.maxPoints)) };
  });

  return { rows: guarded, invalidRubricRows, weakEvidenceRows, hasUsefulOcr };
}

/**
 * Extrage cheia canonică a unei secțiuni din label-ul său.
 * "a) Calcul", "A. forță", "a:" → "a"
 * "Section 1: ..." → "1"
 */
function extractSectionKey(label: string): string {
  const s = (label ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const letter = s.match(/^([a-e])[\)\.\:]/);
  if (letter) return letter[1]!;
  const section = s.match(/^(?:section|sectiunea)\s*(\d+)/);
  if (section) return section[1]!;
  const first = s.match(/^([a-z0-9])/);
  return first ? first[1]! : s.slice(0, 3);
}

/**
 * Reconciliază breakdown-ul returnat de AI cu secțiunile reale ale baremului.
 *
 * Problema: AI-ul poate inventa criterii care se potrivesc cu răspunsul elevului
 * (de ex. A–E) în loc să folosească criteriile profesorului (de ex. a) și b)).
 *
 * Fix: mapăm fiecare rând AI la secțiunea de barem cu aceeași cheie (literă/număr),
 * agregăm punctele, și ignorăm rândurile fără corespondent în barem.
 * Secțiunile din barem fără niciun rând AI primit → points=0, "Neabordat:".
 */
function reconcileWithRubricSections(
  rows: Array<{ label: string; points: number; maxPoints: number; notes: string }>,
  sections: Array<{ label: string; maxPoints: number }>,
): Array<{ label: string; points: number; maxPoints: number; notes: string }> {
  const sectionKeys = sections.map((s) => extractSectionKey(s.label));

  const earnedByKey = new Map<string, number>();
  const notesByKey = new Map<string, string>();
  const aiMaxByKey = new Map<string, number>();

  for (const row of rows) {
    const key = extractSectionKey(row.label);
    if (!sectionKeys.includes(key)) continue; // Criteriu inventat de AI → ignorat
    earnedByKey.set(key, (earnedByKey.get(key) ?? 0) + row.points);
    aiMaxByKey.set(key, (aiMaxByKey.get(key) ?? 0) + row.maxPoints);
    if (!notesByKey.has(key) && row.notes) notesByKey.set(key, row.notes);
  }

  return sections.map((section) => {
    const key = extractSectionKey(section.label);
    // Folosim maxPoints din barem dacă e specificat, altfel din rândul AI corespondent
    const maxPoints =
      section.maxPoints > 0 ? section.maxPoints : (aiMaxByKey.get(key) ?? 0);
    const sumEarned = earnedByKey.get(key) ?? 0;
    const sumAiMax = aiMaxByKey.get(key) ?? 0;
    // Proporțional: cât % din maxPoints-ul AI a câștigat elevul → aplicăm același % pe maxPoints din barem.
    // Păstrăm float pentru scorul brut; conversia la procent 0-100 se face în alignReadableGradingResult.
    const fraction = sumAiMax > 0 ? Math.max(0, Math.min(1, sumEarned / sumAiMax)) : 0;
    const rawEarned = maxPoints > 0 ? fraction * maxPoints : 0;
    // Nu acordăm mai multe puncte decât a câștigat efectiv din scala AI
    const points = Math.min(rawEarned, sumEarned);
    const notes =
      notesByKey.get(key) ?? "Neabordat: criteriul nu apare în răspunsul elevului.";
    return { label: section.label, points, maxPoints, notes };
  });
}

/**
 * OpenAI sometimes returns a `score` that disagrees with `rubric_breakdown`.
 * Users should see one consistent story: final score follows rubric rows.
 */
export function alignReadableGradingResult(
  result: GraderModelResult,
  maxScore: number,
  scopedProblemNumber?: number,
  opts?: {
    gradingRubric?: string;
    ocrExtractedText?: string | null;
    strictContestMode?: boolean;
    useImageBasedRubric?: boolean;
    useImageBasedStatement?: boolean;
  },
): GraderModelResult {
  if (result.readability !== "readable" || result.score == null) return result;

  const scopedRows = scopeBreakdownToProblem(result.rubric_breakdown ?? [], scopedProblemNumber);

  // Normalizare scară: sum(maxPoints) → maxScore, înainte de orice reconciliere.
  const normalizedRows = normalizeRubricBreakdownScale(scopedRows, maxScore);
  // Elimină duplicate (același label) înainte de reconciliere cu baremul profesorului.
  const dedupedRows = deduplicateRubricRows(normalizedRows);

  // Reconciliere cu baremul profesorului: mapăm rândurile AI la secțiunile fixe din barem.
  // Criteriile inventate fără corespondent sunt ignorate; secțiunile lipsă primesc 0 puncte.
  // Pentru bareme din imagini, opts.gradingRubric conține textul extras de AI din imagine.
  const useImageBased = Boolean(opts?.useImageBasedRubric || opts?.useImageBasedStatement);
  const rubricSections = opts?.gradingRubric
    ? parseRubricSections(opts.gradingRubric)
    : null;

  let baseRows: RubricRow[];
  if (rubricSections) {
    baseRows = reconcileWithRubricSections(scopedRows, rubricSections);
  } else if (useImageBased) {
    // Baremul este imagine dar extragerea a eșuat → un singur rând generic cu scorul global.
    // Aplicăm gardurile de sub-puncte pe rândurile AI înainte de a calcula totalul, astfel
    // încât sub-punctele neabordate să nu gonfleze scorul din rândul generic.
    const attemptedForFallback = normalizeAttemptedSubParts(result.attempted_subparts);
    const guardedForFallback = applySubPartAttemptGuards(dedupedRows, attemptedForFallback);
    const totalEarned = sumBreakdownPoints(guardedForFallback);
    baseRows = [
      {
        label: "Conform baremului atașat",
        points: Math.max(0, Math.min(maxScore, totalEarned)),
        maxPoints: maxScore,
        notes: "Baremul a fost furnizat ca imagine. Evaluarea AI a fost calculată global din imaginile baremului.",
      },
    ];
  } else {
    baseRows = dedupedRows;
  }

  // Când barem/cerință sunt imagini, AI-ul vede contextul vizual direct — euristicile
  // bazate pe OCR și STUDENT_WORK_MARKERS (specifice unor probleme concrete) nu se aplică.
  // Totuși, regula fundamentală (zero pentru sub-puncte neîncercate conform
  // attempted_subparts) se aplică MEREU, indiferent de sursa baremului.
  const attemptedSubParts = useImageBased
    ? normalizeAttemptedSubParts(result.attempted_subparts)
    : finalizeAttemptedSubParts(result.attempted_subparts, opts?.ocrExtractedText, baseRows);
  const subPartScopedRows = applySubPartAttemptGuards(baseRows, attemptedSubParts);
  const consistentRows = useImageBased
    ? subPartScopedRows
    : applyNotesPointsConsistency(subPartScopedRows, opts?.ocrExtractedText);
  const evidenceRows = applyDeterministicEvidencePenalties(consistentRows);
  const enforcedRows = enforceNeabordatZeros(evidenceRows);
  const guarded = applyRubricAndEvidenceGuards(
    enforcedRows,
    opts?.gradingRubric ?? "",
    opts?.ocrExtractedText ?? null,
    {
      skipLabelRubricAnchor: Boolean(opts?.useImageBasedRubric || opts?.useImageBasedStatement),
    },
  );
  const rows = guarded.rows;
  const totalEarned = sumBreakdownPoints(rows);
  const totalMax = sumBreakdownMaxPoints(rows);

  if (rows.length === 0 || totalMax <= 0) {
    return {
      ...result,
      score: clampScore(Math.min(result.score, maxScore * 0.7), maxScore),
      short_feedback: `${result.short_feedback ?? ""} (Atenție: nu am putut valida clar criteriile strict pe subiectul selectat.)`.trim(),
    };
  }

  // Calea nouă (scară brută): când există secțiuni fixe de barem, calculăm procentul direct
  // fără a rescala maxPoints la maxScore. Score = prettifyDisplayScore(100 * earned / total).
  if (rubricSections) {
    const rawPercent = totalMax > 0 ? (100 * totalEarned) / totalMax : 0;
    let alignedScore = prettifyDisplayScore(rawPercent);
    if (opts?.strictContestMode) {
      if (guarded.invalidRubricRows >= Math.max(2, rows.length)) {
        alignedScore = Math.min(alignedScore, 70);
      }
      if (guarded.weakEvidenceRows >= Math.max(2, Math.ceil(rows.length / 2))) {
        alignedScore = Math.min(alignedScore, 75);
      }
    }
    const ratio = alignedScore / 100;
    const sanitizeRaw = (text: string | null) => {
      if (!text) return text;
      let t = text;
      if (ratio < 0.999) {
        t = t
          .replace(/\b10\s*\/\s*10\b/gi, "")
          .replace(/\bfull\s*marks\b/gi, "")
          .replace(/\bperfect\b/gi, "")
          .replace(/rezolvare\s+complet[aă]/gi, "rezolvare parțială")
          .replace(/\bcomplet[aă]\b/gi, "parțial")
          .trim();
      }
      t = t
        .replace(/\bfinal_feedback\d+_[a-z0-9_]+\b/gi, "")
        .replace(/\bthis_subtopic_not_summarize_outside_of_rubric\b/gi, "")
        .replace(/\btextBars_for_clarity\b/gi, "")
        .trim();
      return t;
    };
    return {
      ...result,
      score: alignedScore,
      rubric_breakdown: rows,
      short_feedback: sanitizeRaw(result.short_feedback),
      final_feedback:
        (sanitizeRaw(result.final_feedback) ?? "") +
        "\n\n(Notă: punctajul afișat reprezintă procentul din baremul problemei.)",
    };
  }

  const factor = maxScore / totalMax;

  // Scale per-row max points to the platform maxScore (PDF rubrics are often /10 while the app uses /100).
  const scaledMaxes = rows.map((r) => ({
    ...r,
    maxPoints: Math.max(1, Math.round(r.maxPoints * factor)),
  }));
  let maxSum = sumBreakdownMaxPoints(scaledMaxes);
  let guard = 0;
  while (maxSum !== maxScore && guard < 10000) {
    const idx = guard % scaledMaxes.length;
    if (maxSum > maxScore) scaledMaxes[idx]!.maxPoints = Math.max(1, scaledMaxes[idx]!.maxPoints - 1);
    else scaledMaxes[idx]!.maxPoints = scaledMaxes[idx]!.maxPoints + 1;
    maxSum = sumBreakdownMaxPoints(scaledMaxes);
    guard++;
  }

  // Scorul final se raportează la baremul COMPLET (maxScore), nu la suma rândurilor
  // returnate de AI. Dacă AI-ul omite rânduri pentru criterii neabordate, acele criterii
  // contribuie cu 0 la numărător, dar numitorul rămâne totalul fix al baremului.
  // Folosim Math.max(totalMax, maxScore) pentru a acoperi și cazul rar în care AI-ul
  // returnează un total mai mare decât maxScore (eroare de normalizare).
  const targetEarned = clampScore(
    Math.round((totalEarned / Math.max(totalMax, maxScore)) * maxScore),
    maxScore,
  );

  const fractional = scaledMaxes.map((r, i) => {
    const src = rows[i]!;
    const rowFrac = Math.max(0, Math.min(1, src.maxPoints > 0 ? src.points / src.maxPoints : 0));
    const exact = rowFrac * r.maxPoints;
    const base = Math.floor(exact);
    const rem = exact - base;
    return { row: { ...r, points: Math.min(r.maxPoints, base) }, rem };
  });

  let earnedSum = fractional.reduce((s, x) => s + x.row.points, 0);
  const order = fractional
    .map((x, idx) => ({ idx, rem: x.rem }))
    .sort((a, b) => b.rem - a.rem)
    .map((x) => x.idx);

  let p = 0;
  let lastSum = -1;
  while (earnedSum < targetEarned && p < 20000) {
    const idx = order[p % order.length]!;
    const row = fractional[idx]!.row;
    if (row.points < row.maxPoints) row.points += 1;
    earnedSum = fractional.reduce((s, x) => s + x.row.points, 0);
    if (earnedSum === lastSum) break;
    lastSum = earnedSum;
    p++;
  }

  p = 0;
  lastSum = -1;
  while (earnedSum > targetEarned && p < 20000) {
    const idx = order[(order.length - 1 - (p % order.length) + order.length) % order.length]!;
    const row = fractional[idx]!.row;
    if (row.points > 0) row.points -= 1;
    earnedSum = fractional.reduce((s, x) => s + x.row.points, 0);
    if (earnedSum === lastSum) break;
    lastSum = earnedSum;
    p++;
  }

  const scaledRows = fractional.map((x) => ({
    ...x.row,
    points: Math.min(x.row.points, x.row.maxPoints),
  }));

  let alignedScore = clampScore(sumBreakdownPoints(scaledRows), maxScore);
  if (opts?.strictContestMode) {
    if (guarded.invalidRubricRows >= Math.max(2, scaledRows.length)) {
      alignedScore = Math.min(alignedScore, Math.round(maxScore * 0.7));
    }
    if (guarded.weakEvidenceRows >= Math.max(2, Math.ceil(scaledRows.length / 2))) {
      alignedScore = Math.min(alignedScore, Math.round(maxScore * 0.75));
    }
  }

  const ratio = maxScore > 0 ? alignedScore / maxScore : 0;
  const sanitize = (text: string | null) => {
    if (!text) return text;
    let t = text;
    // If not actually perfect, remove common "perfect" phrasing that models overuse.
    if (ratio < 0.999) {
      t = t
        .replace(/\b10\s*\/\s*10\b/gi, "")
        .replace(/\bfull\s*marks\b/gi, "")
        .replace(/\bperfect\b/gi, "")
        .replace(/rezolvare\s+complet[aă]/gi, "rezolvare parțială")
        .replace(/\bcomplet[aă]\b/gi, "parțial")
        .trim();
    }
    t = t
      .replace(/\bfinal_feedback\d+_[a-z0-9_]+\b/gi, "")
      .replace(/\bthis_subtopic_not_summarize_outside_of_rubric\b/gi, "")
      .replace(/\btextBars_for_clarity\b/gi, "")
      .trim();
    return t;
  };

  const note =
    totalMax !== maxScore
      ? `\n\n(Notă: punctajul final a fost aliniat la suma rubricii, scalată la ${maxScore} puncte.)`
      : `\n\n(Notă: punctajul final a fost aliniat la suma rubricii.)`;
  const guardrailNote = "";

  return {
    ...result,
    score: alignedScore,
    rubric_breakdown: scaledRows,
    short_feedback: sanitize(result.short_feedback),
    final_feedback: sanitize(result.final_feedback) + note + guardrailNote,
  };
}

function romanFor(n: number): string {
  const map: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
  };
  return map[n] ?? String(n);
}

function extractTargetProblemSection(raw: string | null, problemNumber: number): string | null {
  if (!raw) return null;
  const text = raw.replace(/\r\n/g, "\n");
  const n = problemNumber;
  const rn = romanFor(n);
  const nextRn = romanFor(n + 1);

  const startPatterns = [
    new RegExp(`\\bSubiect(?:ul)?\\s+${rn}\\b`, "i"),
    new RegExp(`\\bSubiect(?:ul)?\\s+${n}\\b`, "i"),
    new RegExp(`\\bProblema\\s+${n}\\b`, "i"),
    new RegExp(`\\bProblem\\s+${n}\\b`, "i"),
  ];
  const endPatterns = [
    new RegExp(`\\bSubiect(?:ul)?\\s+${nextRn}\\b`, "i"),
    new RegExp(`\\bSubiect(?:ul)?\\s+${n + 1}\\b`, "i"),
    new RegExp(`\\bProblema\\s+${n + 1}\\b`, "i"),
    new RegExp(`\\bProblem\\s+${n + 1}\\b`, "i"),
  ];

  let start = -1;
  for (const p of startPatterns) {
    const m = text.match(p);
    if (m?.index != null) {
      start = m.index;
      break;
    }
  }
  if (start < 0) return null;

  const after = text.slice(start + 1);
  let endRelative = -1;
  for (const p of endPatterns) {
    const m = after.match(p);
    if (m?.index != null) {
      endRelative = m.index;
      break;
    }
  }

  const section = endRelative >= 0 ? text.slice(start, start + 1 + endRelative) : text.slice(start);
  const trimmed = section.trim();
  return trimmed.length > 100 ? trimmed : null;
}

function safeSlice(text: string | null | undefined, maxChars: number): string {
  if (!text) return "";
  return text.slice(0, maxChars);
}

async function tryReadPublicFileBytes(publicUrl: string | null | undefined): Promise<Uint8Array | null> {
  if (!publicUrl || !publicUrl.startsWith("/")) return null;
  try {
    const diskPath = publicUrlToDiskPath(publicUrl);
    return new Uint8Array(await readFile(diskPath));
  } catch {
    return null;
  }
}

export async function gradeSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        select: {
          id: true,
          subject: true,
          maxScore: true,
          expectedConcepts: true,
          gradingRubric: true,
          extractedRubricText: true,
          statement: true,
          officialSolution: true,
          attachments: {
            where: { fileType: "IMAGE", role: { in: ["STATEMENT", "RUBRIC"] } },
            select: { id: true, fileUrl: true, fileType: true, role: true, sortOrder: true },
            orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
          },
        },
      },
      contestSetProblem: {
        select: {
          id: true,
          title: true,
          orderNumber: true,
          maxScore: true,
          extractedRubricText: true,
          statementTextOverride: true,
          solutionText: true,
          contestSet: {
            select: {
              id: true,
              title: true,
              competitionName: true,
              statementText: true,
              statementPdfUrl: true,
              rubricPdfUrl: true,
              rubricText: true,
              attachments: {
                select: {
                  id: true,
                  fileUrl: true,
                  fileType: true,
                  role: true,
                  problemOrderNumber: true,
                  sortOrder: true,
                },
                orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
              },
            },
          },
        },
      },
      user: { select: { aiTeacherStyle: true } },
    },
  });

  if (!submission) throw new Error("Submission not found");
  if (submission.status !== "PENDING") return submission;

  const diskPath = imageUrlToDiskPath(submission.imageUrl);
  let imageBytes: Uint8Array;
  try {
    imageBytes = new Uint8Array(await readFile(diskPath));
  } catch {
    return prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "FAILED",
        aiFeedback: "Internal grading error: image file missing.",
        reviewedAt: new Date(),
      },
    });
  }

  const mimeType = detectMimeType(imageBytes);
  if (!mimeType.startsWith("image/")) {
    return prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "FAILED",
        aiFeedback: "Internal grading error: unsupported image format.",
        reviewedAt: new Date(),
      },
    });
  }

  const problemAttachments = submission.problem?.attachments ?? [];
  const hasProblemStatementImgs = problemAttachments.some((a) => a.role === "STATEMENT");
  const hasProblemRubricImgs = problemAttachments.some((a) => a.role === "RUBRIC");

  const contestAttachments = submission.contestSetProblem?.contestSet.attachments ?? [];
  const contestOrder = submission.contestSetProblem?.orderNumber;
  const hasProblemStatementImages = Boolean(
    contestOrder &&
      contestAttachments.some(
        (a) => a.role === "PROBLEM_STATEMENT" && a.problemOrderNumber === contestOrder && a.fileType === "IMAGE",
      ),
  );
  const hasProblemRubricImages = Boolean(
    contestOrder &&
      contestAttachments.some(
        (a) => a.role === "PROBLEM_RUBRIC" && a.problemOrderNumber === contestOrder && a.fileType === "IMAGE",
      ),
  );

  const contestStatementPdfText =
    submission.contestSetProblem && !hasProblemStatementImages
      ? await extractPdfTextFromPublicUrl(submission.contestSetProblem.contestSet.statementPdfUrl)
      : null;
  const contestRubricPdfText =
    submission.contestSetProblem && !hasProblemRubricImages
      ? await extractPdfTextFromPublicUrl(submission.contestSetProblem.contestSet.rubricPdfUrl)
      : null;
  const contestRubricText =
    submission.contestSetProblem && !hasProblemRubricImages
      ? (submission.contestSetProblem.contestSet.rubricText ?? null)
      : null;
  const statementProblemSection = submission.contestSetProblem
    ? extractTargetProblemSection(contestStatementPdfText, submission.contestSetProblem.orderNumber)
    : null;
  const rubricProblemSectionFromPdf = submission.contestSetProblem
    ? extractTargetProblemSection(contestRubricPdfText, submission.contestSetProblem.orderNumber)
    : null;
  const rubricProblemSectionFromText = submission.contestSetProblem
    ? extractTargetProblemSection(contestRubricText, submission.contestSetProblem.orderNumber)
    : null;
  const rubricProblemSection = rubricProblemSectionFromPdf ?? rubricProblemSectionFromText;

  const gradingContext = submission.problem
    ? {
        statement: hasProblemStatementImgs
          ? "(Cerința problemei este în imaginile atașate. Folosește-le ca sursă principală pentru context.)"
          : submission.problem.statement,
        officialSolution: submission.problem.officialSolution,
        gradingRubric: hasProblemRubricImgs
          ? "(Baremul problemei este în imaginile atașate. Criteriile și punctajele trebuie luate EXCLUSIV din aceste imagini.)"
          : submission.problem.gradingRubric,
        maxScore: submission.problem.maxScore,
      }
    : submission.contestSetProblem
      ? {
          statement: hasProblemStatementImages
            ? "(Cerința acestei probleme este în imaginile atașate — secțiunea PROBLEM_STATEMENT. Nu folosi text din alte subiecte.)"
            : safeSlice(
                statementProblemSection ??
                  submission.contestSetProblem.statementTextOverride ??
                  contestStatementPdfText ??
                  "",
                12000,
              ),
          officialSolution: "",
          gradingRubric: hasProblemRubricImages
            ? "(Baremul acestei probleme este în imaginile atașate — secțiunea PROBLEM_RUBRIC. Criteriile și punctajele trebuie luate DOAR din aceste imagini.)"
            : safeSlice(rubricProblemSection ?? contestRubricText ?? contestRubricPdfText ?? "", 16000),
          maxScore: submission.contestSetProblem.maxScore,
          contestMeta: {
            contestSetTitle: submission.contestSetProblem.contestSet.title,
            contestName: submission.contestSetProblem.contestSet.competitionName,
            problemTitle: submission.contestSetProblem.title,
            problemNumber: submission.contestSetProblem.orderNumber,
            statementPdfUrl: submission.contestSetProblem.contestSet.statementPdfUrl,
            rubricPdfUrl: submission.contestSetProblem.contestSet.rubricPdfUrl,
            rubricPdfExtractAvailable: Boolean(rubricProblemSection || contestRubricText || contestRubricPdfText),
            usedRubricSectionIsolation: Boolean(rubricProblemSection),
            usedStatementSectionIsolation: Boolean(statementProblemSection),
            hasProblemStatementImages,
            hasProblemRubricImages,
          },
        }
      : null;

  if (!gradingContext) {
    return prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "FAILED",
        aiFeedback: "Internal grading error: submission target missing.",
        reviewedAt: new Date(),
      },
    });
  }

  let result;
  let gradingStage = "init";
  let extractedRubricTextOuter: string | undefined;
  let rawRubricTotalOuter: number | null = null;
  try {
    const teacherStyle = submission.user?.aiTeacherStyle ?? AiTeacherStyle.SUPPORTIVE_TEACHER;
    const scopedProblemNumber = submission.contestSetProblem?.orderNumber;
    const supportingFiles: Array<{ filename: string; mimeType: string; bytes: Uint8Array }> = [];
    const supportingImages = submission.contestSetProblem
      ? (
          await Promise.all(
            submission.contestSetProblem.contestSet.attachments
              .filter(
                (a) =>
                  a.fileType === "IMAGE" &&
                  a.problemOrderNumber === submission.contestSetProblem!.orderNumber &&
                  (a.role === "PROBLEM_STATEMENT" || a.role === "PROBLEM_RUBRIC"),
              )
              .slice(0, 12)
              .map(async (a) => {
                const bytes = await tryReadPublicFileBytes(a.fileUrl);
                if (!bytes) return null;
                const m = detectMimeType(bytes);
                if (!m.startsWith("image/")) return null;
                return { mimeType: m, bytes };
              }),
          )
        ).filter((x): x is { mimeType: string; bytes: Uint8Array } => Boolean(x))
      : submission.problem
        ? (
            await Promise.all(
              problemAttachments
                .slice(0, 12)
                .map(async (a) => {
                  const bytes = await tryReadPublicFileBytes(a.fileUrl);
                  if (!bytes) return null;
                  const m = detectMimeType(bytes);
                  if (!m.startsWith("image/")) return null;
                  return { mimeType: m, bytes };
                }),
            )
          ).filter((x): x is { mimeType: string; bytes: Uint8Array } => Boolean(x))
        : [];

    // Extrage structura baremului din imagini (pass separat, fără imaginea elevului).
    // Se folosește cache-ul din DB dacă există; altfel se apelează AI și se persistă.
    const isImageBasedRubric = Boolean(hasProblemRubricImages || hasProblemRubricImgs);
    const cachedRubricText =
      submission.problem?.extractedRubricText ?? submission.contestSetProblem?.extractedRubricText ?? null;
    let extractedRubricText: string | undefined = cachedRubricText ?? undefined;
    gradingStage = "rubric-extraction";
    if (isImageBasedRubric && !cachedRubricText) {
      const rubricImgAttachments = submission.contestSetProblem && contestOrder
        ? contestAttachments.filter(
            (a) => a.fileType === "IMAGE" && a.role === "PROBLEM_RUBRIC" && a.problemOrderNumber === contestOrder,
          ).slice(0, 6)
        : submission.problem
          ? problemAttachments.filter((a) => a.role === "RUBRIC" && a.fileType === "IMAGE").slice(0, 6)
          : [];
      const rubricImgBytes = (
        await Promise.all(
          rubricImgAttachments.map(async (a) => {
            const bytes = await tryReadPublicFileBytes(a.fileUrl);
            if (!bytes) return null;
            const m = detectMimeType(bytes);
            if (!m.startsWith("image/")) return null;
            return { mimeType: m, bytes };
          }),
        )
      ).filter((x): x is { mimeType: string; bytes: Uint8Array } => Boolean(x));
      if (rubricImgBytes.length > 0) {
        const extracted = await extractRubricSectionsFromImages(rubricImgBytes);
        if (extracted) {
          extractedRubricText = extracted;
          // Persistă textul extras pentru a evita re-extragerea la evaluări viitoare.
          const now = new Date();
          if (submission.problem) {
            prisma.problem.update({
              where: { id: submission.problem.id },
              data: { extractedRubricText: extracted, extractedRubricTextUpdatedAt: now },
            }).catch((e: unknown) => console.warn("[grading] nu s-a putut persista extractedRubricText pe Problem:", e));
          } else if (submission.contestSetProblem) {
            prisma.contestSetProblem.update({
              where: { id: submission.contestSetProblem.id },
              data: { extractedRubricText: extracted, extractedRubricTextUpdatedAt: now },
            }).catch((e: unknown) => console.warn("[grading] nu s-a putut persista extractedRubricText pe ContestSetProblem:", e));
          }
        }
      }
    }

    gradingStage = "openai-grading";
    // Pre-calculăm rawRubricTotal pentru a-l trimite la AI (lucrează la scara corectă a baremului).
    const rubricTextForGrading = extractedRubricText ?? gradingContext.gradingRubric;
    const rubricSectionsForGrading = parseRubricSections(rubricTextForGrading);
    const rawRubricTotalForGrading =
      rubricSectionsForGrading != null && rubricSectionsForGrading.length > 0
        ? rubricSectionsForGrading.reduce((s, r) => s + r.maxPoints, 0)
        : undefined;
    extractedRubricTextOuter = extractedRubricText;
    rawRubricTotalOuter = rawRubricTotalForGrading ?? null;
    result = await gradeWithOpenAi({
      problem: {
        statement: gradingContext.statement,
        officialSolution: gradingContext.officialSolution,
        gradingRubric: gradingContext.gradingRubric,
        maxScore: gradingContext.maxScore,
      },
      submission: { ocrExtractedText: submission.ocrExtractedText },
      imageBytes,
      imageMimeType: mimeType,
      teacherStyle,
      extractedRubricText,
      rawRubricTotal: rawRubricTotalForGrading,
      contestMeta: "contestMeta" in gradingContext ? gradingContext.contestMeta : undefined,
      supportingFiles,
      supportingImages,
    });
    gradingStage = "align-result";
    result = alignReadableGradingResult(result, gradingContext.maxScore, scopedProblemNumber, {
      gradingRubric: extractedRubricText ?? gradingContext.gradingRubric,
      ocrExtractedText: submission.ocrExtractedText,
      strictContestMode: Boolean(submission.contestSetProblem),
      useImageBasedRubric: hasProblemRubricImages || hasProblemRubricImgs,
      useImageBasedStatement: hasProblemStatementImages || hasProblemStatementImgs,
    });
  } catch (error) {
    const problemId = submission.problem?.id ?? null;
    const contestSetProblemId = submission.contestSetProblem?.id ?? null;
    const errName = error instanceof Error ? error.constructor.name : typeof error;
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? (error.stack ?? "") : "";

    // OpenAI SDK
    const openAiStatus: number | undefined = (error as { status?: number })?.status;
    const openAiCode: string | undefined = (error as { code?: string })?.code;
    const openAiType: string | undefined = (error as { type?: string })?.type;
    const openAiErrorBody: unknown = (error as { error?: unknown })?.error;

    // Prisma — câmpul/modelul/codul problemei
    const prismaCode: string | undefined = (error as { code?: string })?.code;
    const prismaMeta: unknown = (error as { meta?: unknown })?.meta;
    const prismaClientVersion: string | undefined = (error as { clientVersion?: string })?.clientVersion;

    // JSON parse — textul brut dacă eroarea vine din parsare răspuns AI
    const rawResponseSnippet: string | undefined =
      errMessage.includes("JSON") || errMessage.includes("parse") || errMessage.includes("token")
        ? errMessage.slice(0, 500)
        : undefined;

    console.error(
      `[grading] FAILED — submissionId=${submission.id} problemId=${problemId ?? contestSetProblemId} stage=${gradingStage}`,
      {
        errorName: errName,
        errorMessage: errMessage,
        openAiHttpStatus: openAiStatus,
        openAiCode,
        openAiType,
        openAiErrorBody: JSON.stringify(openAiErrorBody).slice(0, 500),
        prismaCode,
        prismaMeta: JSON.stringify(prismaMeta).slice(0, 300),
        prismaClientVersion,
        rawResponseSnippet,
        stack: errStack.split("\n").slice(0, 12).join("\n"),
      },
    );

    return prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "FAILED",
        aiFeedback: "Internal grading error: model output invalid or request failed.",
        reviewedAt: new Date(),
      },
    });
  }

  if (result.readability === "rejected") {
    return prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "BLURRY_REJECTED",
        imageQualityReason: sanitizeForDb(result.reason) ?? "Image unreadable for grading.",
        aiScore: null,
        aiFeedback: null,
        aiBreakdown: Prisma.DbNull,
        reviewedAt: new Date(),
        visibilityUnlocked: false,
      },
    });
  }

  // rawRubricTotal și extractedRubricText au fost calculați în interiorul try-ului.
  const rawRubricTotal = rawRubricTotalOuter;

  const finalRows = (result.rubric_breakdown ?? []) as RubricRow[];
  const expectedSumMax =
    rawRubricTotal != null && rawRubricTotal > 0 ? rawRubricTotal : gradingContext.maxScore;
  const validation = validateFinalRubricRows(finalRows, expectedSumMax);
  if (!validation.valid) {
    // Assertion hard: salvăm FAILED în loc de date invalide în DB.
    console.error(
      `[grading] ASSERTION FAILED înainte de salvare — submissionId=${submission.id}`,
      { reason: validation.reason, finalRows: JSON.stringify(finalRows).slice(0, 500) },
    );
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", aiFeedback: "Internal grading error: invalid rubric breakdown.", reviewedAt: new Date() },
    });
  }
  // Scorul final:
  // - Calea rubricSections: result.score = prettifyDisplayScore(100 * earned / total), deja calculat.
  // - Calea veche: suma punctelor din rânduri, clampată la maxScore.
  const aiScore =
    rawRubricTotal != null && rawRubricTotal > 0
      ? Math.max(0, Math.min(100, Math.round(result.score ?? 0)))
      : clampScore(sumBreakdownPoints(finalRows), gradingContext.maxScore || 100);
  // Assertion
  const computedSum = sumBreakdownPoints(finalRows);
  if (rawRubricTotal != null && rawRubricTotal > 0) {
    if (aiScore < 0 || aiScore > 100) {
      console.error(
        `[grading] ASSERTION aiScore out of range — submissionId=${submission.id}`,
        { aiScore, computedSum, rawRubricTotal },
      );
    }
  } else if (aiScore !== clampScore(computedSum, gradingContext.maxScore || 100) || aiScore > gradingContext.maxScore) {
    console.error(
      `[grading] ASSERTION aiScore inconsistent — submissionId=${submission.id}`,
      { aiScore, computedSum, maxScore: gradingContext.maxScore },
    );
  }
  const aiFeedback = sanitizeForDb(
    `${result.short_feedback ?? ""}\n\n${result.final_feedback ?? ""}`.trim(),
  );

  return prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "GRADED",
      aiScore,
      aiFeedback,
      aiBreakdown: sanitizeObjectForDb({
        rubric_breakdown: result.rubric_breakdown,
        detected_strengths: result.detected_strengths,
        detected_mistakes: result.detected_mistakes,
        attempted_subparts: result.attempted_subparts ?? [],
      }),
      reviewedAt: new Date(),
      visibilityUnlocked: aiScore >= 90,
      imageQualityReason: null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline simplu — înlocuitor al gradeSubmission
// ─────────────────────────────────────────────────────────────────────────────

export async function gradeSubmissionSimple(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        select: {
          id: true,
          title: true,
          maxScore: true,
          gradingRubric: true,
          extractedRubricText: true,
          statement: true,
          officialSolution: true,
          attachments: {
            where: { fileType: "IMAGE", role: { in: ["STATEMENT", "RUBRIC"] } },
            select: { id: true, fileUrl: true, fileType: true, role: true, sortOrder: true },
            orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
          },
        },
      },
      contestSetProblem: {
        select: {
          id: true,
          title: true,
          orderNumber: true,
          maxScore: true,
          extractedRubricText: true,
          aiRubricJson: true,
          statementTextOverride: true,
          contestSet: {
            select: {
              id: true,
              title: true,
              statementPdfUrl: true,
              rubricPdfUrl: true,
              rubricText: true,
              attachments: {
                select: { id: true, fileUrl: true, fileType: true, role: true, problemOrderNumber: true, sortOrder: true },
                orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
              },
            },
          },
        },
      },
      user: { select: { aiTeacherStyle: true, id: true, username: true } },
    },
  });

  if (!submission) throw new Error("Submission not found");
  if (submission.status !== "PENDING") return submission;

  // ── Citire imagine elev ──────────────────────────────────────────────────
  const diskPath = imageUrlToDiskPath(submission.imageUrl);
  let imageBytes: Uint8Array;
  try {
    imageBytes = new Uint8Array(await readFile(diskPath));
  } catch {
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", aiFeedback: "Eroare internă: fișierul imagine lipsește.", reviewedAt: new Date() },
    });
  }

  const mimeType = detectMimeType(imageBytes);
  if (!mimeType.startsWith("image/")) {
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", aiFeedback: "Eroare internă: format imagine nesuportat.", reviewedAt: new Date() },
    });
  }

  const extraUrls: string[] = (() => {
    try { return JSON.parse(submission.extraImageUrls ?? "[]") as string[]; } catch { return []; }
  })();
  const extraStudentImages = (
    await Promise.all(
      extraUrls.map(async (url) => {
        const bytes = await tryReadPublicFileBytes(url);
        if (!bytes) return null;
        const m = detectMimeType(bytes);
        if (!m.startsWith("image/")) return null;
        return { bytes, mimeType: m };
      }),
    )
  ).filter((x): x is { bytes: Uint8Array; mimeType: string } => Boolean(x));

  const studentImages = [{ bytes: imageBytes, mimeType }, ...extraStudentImages];

  // ── Context problemă ────────────────────────────────────────────────────
  const contestOrder = submission.contestSetProblem?.orderNumber;
  const contestAttachments = submission.contestSetProblem?.contestSet.attachments ?? [];
  const problemAttachments = submission.problem?.attachments ?? [];

  const hasProblemRubricImgs = problemAttachments.some((a) => a.role === "RUBRIC");
  const hasProblemStatementImgs = problemAttachments.some((a) => a.role === "STATEMENT");
  const hasProblemRubricImages = Boolean(
    contestOrder &&
      contestAttachments.some(
        (a) => a.role === "PROBLEM_RUBRIC" && a.problemOrderNumber === contestOrder && a.fileType === "IMAGE",
      ),
  );
  const hasProblemStatementImages = Boolean(
    contestOrder &&
      contestAttachments.some(
        (a) => a.role === "PROBLEM_STATEMENT" && a.problemOrderNumber === contestOrder && a.fileType === "IMAGE",
      ),
  );

  // Text enunț
  const contestStatementPdfText =
    submission.contestSetProblem && !hasProblemStatementImages
      ? await extractPdfTextFromPublicUrl(submission.contestSetProblem.contestSet.statementPdfUrl)
      : null;
  const statementSection = submission.contestSetProblem
    ? extractTargetProblemSection(contestStatementPdfText, submission.contestSetProblem.orderNumber)
    : null;

  const statement = submission.problem
    ? hasProblemStatementImgs
      ? "(Cerința problemei este în imaginile atașate.)"
      : submission.problem.statement
    : submission.contestSetProblem
      ? hasProblemStatementImages
        ? "(Cerința problemei este în imaginile atașate.)"
        : safeSlice(
            statementSection ??
              submission.contestSetProblem.statementTextOverride ??
              contestStatementPdfText ??
              "",
            12000,
          )
      : null;

  if (!statement && statement !== "") {
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", aiFeedback: "Eroare internă: problema sursă lipsește.", reviewedAt: new Date() },
    });
  }

  // ── Barem text ──────────────────────────────────────────────────────────
  const isImageBasedRubric = Boolean(hasProblemRubricImages || hasProblemRubricImgs);
  const cachedRubricText =
    submission.problem?.extractedRubricText ?? submission.contestSetProblem?.extractedRubricText ?? null;

  // Imaginile enunțului și baremului — separate pentru pipeline-ul în doi pași
  const statementImages: Array<{ mimeType: string; bytes: Uint8Array }> = [];
  const rubricImages: Array<{ mimeType: string; bytes: Uint8Array }> = [];
  const attachmentsToLoad = submission.contestSetProblem && contestOrder
    ? contestAttachments.filter(
        (a) =>
          a.fileType === "IMAGE" &&
          a.problemOrderNumber === contestOrder &&
          (a.role === "PROBLEM_STATEMENT" || a.role === "PROBLEM_RUBRIC"),
      ).slice(0, 8)
    : problemAttachments.slice(0, 8);

  for (const a of attachmentsToLoad) {
    const bytes = await tryReadPublicFileBytes(a.fileUrl);
    if (!bytes) continue;
    const m = detectMimeType(bytes);
    if (!m.startsWith("image/")) continue;
    if (a.role === "STATEMENT" || a.role === "PROBLEM_STATEMENT") {
      statementImages.push({ mimeType: m, bytes });
    } else if (a.role === "RUBRIC" || a.role === "PROBLEM_RUBRIC") {
      rubricImages.push({ mimeType: m, bytes });
    }
  }

  // Extrage text din imaginile baremului (cu cache) — folosit ca fallback text
  let rubricText: string | null = cachedRubricText;
  if (isImageBasedRubric && !cachedRubricText) {
    const rubricImgs = rubricImages;
    const extracted = rubricImgs.length > 0
      ? await extractRubricSectionsFromImages(rubricImgs).catch(() => "")
      : "";
    if (extracted) {
      rubricText = extracted;
      const now = new Date();
      if (submission.problem) {
        prisma.problem
          .update({ where: { id: submission.problem.id }, data: { extractedRubricText: extracted, extractedRubricTextUpdatedAt: now } })
          .catch(() => {});
      } else if (submission.contestSetProblem) {
        prisma.contestSetProblem
          .update({ where: { id: submission.contestSetProblem.id }, data: { extractedRubricText: extracted, extractedRubricTextUpdatedAt: now } })
          .catch(() => {});
      }
    }
  }

  // Barem final trimis la AI
  const contestRubricPdfText =
    submission.contestSetProblem && !hasProblemRubricImages
      ? await extractPdfTextFromPublicUrl(submission.contestSetProblem.contestSet.rubricPdfUrl)
      : null;
  const contestRubricText = submission.contestSetProblem?.contestSet.rubricText ?? null;
  const rubricProblemSection = submission.contestSetProblem
    ? extractTargetProblemSection(contestRubricPdfText, submission.contestSetProblem.orderNumber) ??
      extractTargetProblemSection(contestRubricText, submission.contestSetProblem.orderNumber)
    : null;

  const finalRubricText =
    rubricText ??
    (submission.problem
      ? isImageBasedRubric
        ? "(Baremul este atașat ca imagini — criteriile și punctajele sunt vizibile în imaginile atașate.)"
        : submission.problem.gradingRubric
      : submission.contestSetProblem
        ? hasProblemRubricImages
          ? "(Baremul este atașat ca imagini — criteriile și punctajele sunt vizibile în imaginile atașate.)"
          : safeSlice(rubricProblemSection ?? contestRubricText ?? contestRubricPdfText ?? "", 16000)
        : "");

  if (!finalRubricText) {
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", aiFeedback: "Eroare internă: baremul lipsește.", reviewedAt: new Date() },
    });
  }

  // ── Apel AI ─────────────────────────────────────────────────────────────
  const storedRubricRaw = submission.contestSetProblem?.aiRubricJson ?? null;
  let preGeneratedRubric: MasterRubric | undefined;
  if (storedRubricRaw) {
    try {
      preGeneratedRubric = JSON.parse(storedRubricRaw) as MasterRubric;
    } catch { /* ignore parse error, fall back to generating */ }
  }

  // If no stored rubric for a contest problem, generate one now and persist it so all
  // future submissions for this problem use identical criteria names and point weights.
  if (!preGeneratedRubric && submission.contestSetProblem) {
    try {
      const autoRubric = await generateMasterRubric({
        statement: statement ?? "",
        rubricText: finalRubricText,
        statementImages,
        rubricImages,
      });
      console.info(
        `[grading-simple] Auto-generated rubric for contestSetProblem=${submission.contestSetProblem.id} — saving to DB`,
      );
      prisma.contestSetProblem
        .update({ where: { id: submission.contestSetProblem.id }, data: { aiRubricJson: JSON.stringify(autoRubric) } })
        .catch((e: unknown) => console.warn("[grading-simple] Failed to save auto-generated rubric:", e));
      preGeneratedRubric = autoRubric;
    } catch (e) {
      console.warn("[grading-simple] Auto-rubric generation failed, gradeSimpleWithOpenAi will generate internally:", e);
    }
  }

  let aiResult;
  try {
    aiResult = await gradeSimpleWithOpenAi({
      statement: statement ?? "",
      rubricText: finalRubricText,
      studentImages,
      ocrText: submission.ocrExtractedText,
      statementImages,
      rubricImages,
      preGeneratedRubric,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "").split("\n").slice(0, 5).join(" | ") : "";
    console.error(`[grading-simple] FAILED submissionId=${submission.id} error="${msg}" stack="${stack}"`);
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", aiFeedback: "Eroare internă: corectarea AI a eșuat.", reviewedAt: new Date() },
    });
  }

  console.info(
    `[grading-simple] result submissionId=${submission.id} readability=${aiResult.readability} total_barem=${aiResult.total_barem} puncte_obtinute=${aiResult.puncte_obtinute} criterii=${aiResult.criterii.length}`,
  );

  // ── Respingere imagine necitibilă ────────────────────────────────────────
  if (aiResult.readability === "rejected") {
    return prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "BLURRY_REJECTED",
        imageQualityReason: sanitizeForDb(aiResult.rejection_reason) ?? "Imagine necitibilă.",
        aiScore: null,
        aiFeedback: null,
        aiBreakdown: Prisma.DbNull,
        reviewedAt: new Date(),
        visibilityUnlocked: false,
      },
    });
  }

  // ── Validare minimă ──────────────────────────────────────────────────────
  const validation = validateSimpleResult(aiResult);
  if (!validation.valid) {
    console.error(`[grading-simple] VALIDARE EȘUATĂ — submissionId=${submission.id}`, {
      reason: validation.reason,
      total_barem: aiResult.total_barem,
      puncte_obtinute: aiResult.puncte_obtinute,
    });
    return prisma.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", aiFeedback: "Eroare internă: date de corectare invalide.", reviewedAt: new Date() },
    });
  }

  // ── Scor final ───────────────────────────────────────────────────────────
  // Scorul este MEREU recalculat în cod, nu luat de la AI.
  const aiScore = computeSimpleScore(aiResult.puncte_obtinute!, aiResult.total_barem!);

  console.info(
    `[grading-simple] score submissionId=${submission.id} total_barem=${aiResult.total_barem} puncte_obtinute=${aiResult.puncte_obtinute} scor_procentual=${aiScore}`,
  );

  // ── Mapare la formatul DB compatibil cu UI ───────────────────────────────
  const rubricBreakdown = aiResult.criterii.map((c) => ({
    label: c.label,
    points: c.puncte_obtinute,
    maxPoints: c.puncte_maxime,
    notes: [c.ce_a_fost_corect, c.ce_lipseste_sau_e_gresit].filter(Boolean).join("\n"),
  }));

  const aiFeedback = sanitizeForDb(
    [aiResult.feedback_general ?? "", ""].filter(Boolean).join("\n").trim(),
  );

  const saved = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: "GRADED",
      aiScore,
      aiFeedback,
      aiBreakdown: sanitizeObjectForDb({
        rubric_breakdown: rubricBreakdown,
        detected_strengths: aiResult.puncte_forte,
        detected_mistakes: aiResult.de_imbunatatit,
        attempted_subparts: [],
      }),
      reviewedAt: new Date(),
      visibilityUnlocked: aiScore >= 90,
      imageQualityReason: null,
    },
  });

  // Fire "first-solve" notification only when user reaches ≥70 for the first time on this problem.
  if (aiScore >= 70 && submission.user) {
    const problemTitle =
      submission.problem?.title ??
      (submission.contestSetProblem
        ? `Problema ${submission.contestSetProblem.orderNumber} din ${submission.contestSetProblem.contestSet?.title ?? "concurs"}`
        : "o problemă");

    const priorSolve = await prisma.submission.findFirst({
      where: {
        id: { not: submission.id },
        userId: submission.userId,
        status: "GRADED",
        aiScore: { gte: 70 },
        ...(submission.problemId
          ? { problemId: submission.problemId }
          : { contestSetProblemId: submission.contestSetProblemId! }),
      },
      select: { id: true },
    });

    if (!priorSolve) {
      const targetUrl = submission.problemId
        ? `/problems/${submission.problemId}`
        : `/contest-sets/${submission.contestSetProblem!.contestSet!.id}/problems/${submission.contestSetProblem!.orderNumber}`;

      await notifyFollowersOfSubmission({
        submissionId: submission.id,
        submitterId: submission.userId,
        submitterUsername: submission.user.username,
        problemId: submission.problemId ?? submission.contestSetProblemId ?? submission.id,
        problemTitle,
        targetUrl,
      }).catch(() => {});
    }
  }

  return saved;
}

