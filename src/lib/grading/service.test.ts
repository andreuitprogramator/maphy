import { describe, it, expect, vi } from "vitest";

// Simulăm modulele cu dependențe externe înainte de orice import din service.ts
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/ai/grader", () => ({ gradeWithOpenAi: vi.fn() }));
vi.mock("@/lib/pdf/extract-text", () => ({ extractPdfTextFromPublicUrl: vi.fn() }));
vi.mock("fs/promises", () => ({ readFile: vi.fn() }));

// ─── Barem de test (format structurat generat de rubricItemsToGradingRubricText) ──
const BAREM_A_SI_B = `Rubric (max 100 total) — apply all sections:

Section 1: a) Calculul forței — max 50 points
Expected evidence / criteria:
Elevul calculează forța netă cu formula corectă și substituție numerică.

Section 2: b) Determinați accelerația — max 50 points
Expected evidence / criteria:
Elevul determină accelerația folosind a doua lege a lui Newton.`;

import { alignReadableGradingResult, prettifyDisplayScore } from "./service";
import type { GraderModelResult } from "@/lib/ai/types";

// ─── Utilitare pentru construirea rezultatelor de test ────────────────────────

function rezultatReadable(override: Partial<GraderModelResult> = {}): GraderModelResult {
  return {
    readability: "readable",
    reason: null,
    student_image_observations: "Elevul a scris ceva.",
    score: 100,
    short_feedback: "Feedback.",
    rubric_breakdown: [],
    detected_strengths: [],
    detected_mistakes: [],
    final_feedback: "Feedback final.",
    attempted_subparts: [],
    ...override,
  };
}

function rand_rb(
  label: string,
  points: number,
  maxPoints: number,
  notes = "",
) {
  return { label, points, maxPoints, notes: notes || `Elevul a rezolvat corect. Rezultat: ${points}p.` };
}

// ─── Teste ────────────────────────────────────────────────────────────────────

describe("alignReadableGradingResult — răspuns parțial", () => {
  it("elevul rezolvă A perfect, B absent → B primește 0, scorul = maxPoints(A)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        rand_rb("A. Forța netă", 40, 40),
        rand_rb("B. Energia cinetică", 60, 60, "Elevul a calculat corect energia. 60p."),
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    const rowA = output.rubric_breakdown?.find((r) => r.label.startsWith("A"));
    const rowB = output.rubric_breakdown?.find((r) => r.label.startsWith("B"));

    expect(rowB?.points).toBe(0);
    expect(rowA?.points).toBeGreaterThan(0);
    expect(output.score).toBeLessThan(100);
    expect(output.score).toBe(rowA?.points ?? 0);
  });

  it("elevul rezolvă B perfect, A absent → A primește 0, scorul = maxPoints(B)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["B"],
      rubric_breakdown: [
        rand_rb("A. Prima lege a lui Newton", 50, 50, "Elevul a explicat perfect. 50p."),
        rand_rb("B. Energia potențială", 50, 50),
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    const rowA = output.rubric_breakdown?.find((r) => r.label.startsWith("A"));
    const rowB = output.rubric_breakdown?.find((r) => r.label.startsWith("B"));

    expect(rowA?.points).toBe(0);
    expect(rowB?.points).toBeGreaterThan(0);
    expect(output.score).toBe(rowB?.points ?? 0);
  });

  it("elevul rezolvă ambele sub-puncte → scorul este maxim", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("A. Forța de frecare", 40, 40),
        rand_rb("B. Accelerația", 60, 60),
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    const rowA = output.rubric_breakdown?.find((r) => r.label.startsWith("A"));
    const rowB = output.rubric_breakdown?.find((r) => r.label.startsWith("B"));

    expect(rowA?.points).toBe(40);
    expect(rowB?.points).toBe(60);
    expect(output.score).toBe(100);
  });

  it("niciun sub-punct rezolvat → scorul este 0", () => {
    const input = rezultatReadable({
      score: 0,
      attempted_subparts: [],
      rubric_breakdown: [
        { label: "A. Prima cerință", points: 0, maxPoints: 50, notes: "Neabordat: elevul nu a scris nimic." },
        { label: "B. A doua cerință", points: 0, maxPoints: 50, notes: "Neabordat: elevul nu a scris nimic." },
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    expect(output.score).toBe(0);
    output.rubric_breakdown?.forEach((r) => expect(r.points).toBe(0));
  });

  it("modelul halucinează B în attempted_subparts dar notes conțin 'Neabordat:' → B = 0", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("A. Calculul vitezei", 40, 40),
        {
          label: "B. Graficul v(t)",
          points: 60,
          maxPoints: 60,
          notes: "Neabordat: elevul nu a desenat graficul.",
        },
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    const rowB = output.rubric_breakdown?.find((r) => r.label.startsWith("B"));
    expect(rowB?.points).toBe(0);
    expect(output.score).toBeLessThan(100);
  });

  it("barem din imagini (useImageBasedRubric=true): B absent → scorul < 100 (rând generic de fallback)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        rand_rb("A. Determinați forța", 50, 50),
        rand_rb("B. Explicați fenomenul", 50, 50, "Elevul a explicat corect. 50p."),
      ],
    });

    // useImageBasedRubric fără gradingRubric → fallback rând generic "Conform baremului atașat"
    const output = alignReadableGradingResult(input, 100, undefined, {
      useImageBasedRubric: true,
    });

    // Cu extragerea eșuată, outputul are un singur rând generic; scorul reflectă sub-punctele abordate
    expect(output.score).toBeLessThan(100);
    expect(output.score).toBeGreaterThanOrEqual(0);
  });

  // ─── Teste pentru bug-ul de scalare ───────────────────────────────────────────
  // Scenariul critic: AI returnează DOAR rândul criteriului rezolvat (omite B),
  // sistemul vechi scala totalEarned/totalMax*100 = 40/40*100 = 100. BUG.
  // Sistemul nou folosește totalEarned/max(totalMax,maxScore)*100 = 40/100*100 = 40.

  it("scorul NU poate fi 100 dacă AI omite B din breakdown (returnează doar A)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        // AI a omis complet rândul B din breakdown
        rand_rb("A. Calculul forței", 40, 40),
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    expect(output.score).toBeLessThan(60);
    expect(output.score).toBe(40);
  });

  it("scorul NU poate fi 100 dacă AI omite B (A valorează 50p din 100)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [rand_rb("A. Determinați viteza", 50, 50)],
    });

    const output = alignReadableGradingResult(input, 100);

    expect(output.score).toBeLessThan(60);
    expect(output.score).toBe(50);
  });

  it("scorul NU poate fi 100 dacă AI omite B și C (A valorează 30p din 100)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [rand_rb("A. Prima cerință", 30, 30)],
    });

    const output = alignReadableGradingResult(input, 100);

    expect(output.score).toBeLessThan(60);
    expect(output.score).toBe(30);
  });

  it("barem din imagini (useImageBasedStatement=true): A absent, B prezent → scorul < 100 (rând generic de fallback)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["B"],
      rubric_breakdown: [
        rand_rb("A. Calculul lungimii", 30, 30, "Elevul a calculat corect. 30p."),
        rand_rb("B. Calculul timpului", 70, 70),
      ],
    });

    // useImageBasedStatement fără gradingRubric → fallback rând generic; A nu este în attempted
    const output = alignReadableGradingResult(input, 100, undefined, {
      useImageBasedStatement: true,
    });

    // Scorul reflectă doar sub-punctul B abordat (A zeroed prin garduri în fallback)
    expect(output.score).toBeLessThan(100);
    expect(output.score).toBeGreaterThanOrEqual(0);
  });

  it("trei sub-puncte: A și C prezente, B absent → B = 0, restul au puncte", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "C"],
      rubric_breakdown: [
        rand_rb("A. Prima parte", 30, 30),
        rand_rb("B. A doua parte", 40, 40, "Elevul a rezolvat corect B. 40p."),
        rand_rb("C. A treia parte", 30, 30),
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    const rowA = output.rubric_breakdown?.find((r) => r.label.startsWith("A"));
    const rowB = output.rubric_breakdown?.find((r) => r.label.startsWith("B"));
    const rowC = output.rubric_breakdown?.find((r) => r.label.startsWith("C"));

    expect(rowB?.points).toBe(0);
    expect(rowA?.points).toBeGreaterThan(0);
    expect(rowC?.points).toBeGreaterThan(0);
    expect(output.score).toBe((rowA?.points ?? 0) + (rowC?.points ?? 0));
  });
});

// ─── Teste pentru criterii inventate de AI ────────────────────────────────────

describe("reconciliere cu baremul real — criterii inventate de AI", () => {
  it("AI inventează A–E în loc de a) și b): output conține EXACT a) și b)", () => {
    // Scenariul raportat: barem are a) și b), AI returnează A, B, C, D, E
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        { label: "A. Reprezentarea forțelor", points: 20, maxPoints: 20, notes: "Forțele sunt reprezentate corect. 20p." },
        { label: "B. Ecuațiile de echilibru", points: 20, maxPoints: 20, notes: "Ecuațiile sunt corecte. 20p." },
        { label: "C. Substituții numerice", points: 20, maxPoints: 20, notes: "Valorile sunt substituite. 20p." },
        { label: "D. Calcul algebric", points: 20, maxPoints: 20, notes: "Calculul este corect. 20p." },
        { label: "E. Rezultat final", points: 20, maxPoints: 20, notes: "Rezultatul este corect. 20p." },
      ],
    });

    const output = alignReadableGradingResult(input, 100, undefined, {
      gradingRubric: BAREM_A_SI_B,
    });

    // Breakdown trebuie să conțină EXACT 2 rânduri (a și b din barem)
    expect(output.rubric_breakdown?.length).toBe(2);

    const rowA = output.rubric_breakdown?.find((r) => /a\)/i.test(r.label));
    const rowB = output.rubric_breakdown?.find((r) => /b\)/i.test(r.label));

    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();

    // b) nu a fost abordat (attempted_subparts=["A"]) → 0 puncte
    expect(rowB?.points).toBe(0);

    // Scorul final trebuie să fie sub 100
    expect(output.score).toBeLessThan(100);
  });

  it("AI inventează A–D (4 criterii) pentru barem cu a) și b): C și D sunt ignorate", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A. Forța de frecare", points: 25, maxPoints: 25, notes: "Corect. 25p." },
        { label: "B. Accelerația", points: 25, maxPoints: 25, notes: "Corect. 25p." },
        { label: "C. Graficul v(t)", points: 25, maxPoints: 25, notes: "Corect. 25p." },
        { label: "D. Concluzie", points: 25, maxPoints: 25, notes: "Corect. 25p." },
      ],
    });

    const output = alignReadableGradingResult(input, 100, undefined, {
      gradingRubric: BAREM_A_SI_B,
    });

    // Doar a) și b) rămân
    expect(output.rubric_breakdown?.length).toBe(2);

    // C și D sunt ignorate → scorul nu poate fi 100
    // (AI a dat 25+25=50 pe a) și b), totalMax=100 → scor ≤ 50)
    expect(output.score).toBeLessThanOrEqual(50);
  });

  it("AI folosește corect a) și b) (fără criterii inventate): output nemodificat", () => {
    const input = rezultatReadable({
      score: 80,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("a) Calculul forței", 50, 50),
        rand_rb("b) Determinați accelerația", 30, 50, "Rezultatul este parțial. 30p."),
      ],
    });

    const output = alignReadableGradingResult(input, 100, undefined, {
      gradingRubric: BAREM_A_SI_B,
    });

    // Ambele criterii sunt păstrate
    expect(output.rubric_breakdown?.length).toBe(2);

    const rowA = output.rubric_breakdown?.find((r) => /a\)/i.test(r.label));
    const rowB = output.rubric_breakdown?.find((r) => /b\)/i.test(r.label));
    expect(rowA?.points).toBeGreaterThan(0);
    expect(rowB?.points).toBeGreaterThan(0);
    expect(output.score).toBeLessThan(100);
    expect(output.score).toBeGreaterThan(0);
  });
});

// ─── Teste pentru normalizare scară, deduplicare și invariante arhitecturale ──

describe("normalizare scară și deduplicare — fix arhitectural complet", () => {
  // Test 1: 2/50 = 4% per criteriu → proporționalizare corectă → 0 puncte pe scara /4
  it("Test 1 — normalizare scară proporțională: maxScore=4, AI returnează 2/50+2/50 → scor=0", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A) Reprezentarea forțelor", points: 2, maxPoints: 50, notes: "Forțele sunt reprezentate corect. Rezultat: 2p." },
        { label: "B) Determinați accelerația", points: 2, maxPoints: 50, notes: "Accelerația este calculată corect. Rezultat: 2p." },
      ],
    });

    const output = alignReadableGradingResult(input, 4);

    // sum(maxPoints) trebuie să fie 4 după normalizare
    const sumMax = output.rubric_breakdown?.reduce((s, r) => s + r.maxPoints, 0) ?? 0;
    expect(sumMax).toBe(4);
    // scorul = suma exactă a punctelor din breakdown
    const sumPoints = output.rubric_breakdown?.reduce((s, r) => s + r.points, 0) ?? 0;
    expect(output.score).toBe(sumPoints);
    // 2/50 = 4% din criteriu → 4% × 2 = 0.08 → rotunjit la 0
    expect(output.score).toBe(0);
  });

  // Test 2: normalizare proporțională + sub-punct parțial; AI acordă 30/50 (60%) per criteriu
  it("Test 2 — normalizare cu sub-punct parțial: maxScore=4, doar a) rezolvat → scor≤2 și >0", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        { label: "a) Calculul distanței", points: 30, maxPoints: 50, notes: "Calculul distanței este corect, formula aplicată. Rezultat: 30p." },
        { label: "b) Calculul timpului", points: 30, maxPoints: 50, notes: "Calculul timpului este corect. Rezultat: 30p." },
      ],
    });

    const BAREM_SIMPLU = `Rubric (max 4 total) — apply all sections:

Section 1: a) Calculul distanței — max 2 points

Section 2: b) Calculul timpului — max 2 points`;

    const output = alignReadableGradingResult(input, 4, undefined, {
      gradingRubric: BAREM_SIMPLU,
    });

    // b) nu a fost abordat → trebuie să fie 0
    const rowB = output.rubric_breakdown?.find((r) => /b\)/i.test(r.label));
    expect(rowB?.points).toBe(0);
    // 30/50 = 60% → displayScore = prettifyDisplayScore(100 * (0.6*2) / 4) = prettifyDisplayScore(30) = 30
    // Scorul este procentual (0-100), nu pe scara brută (/4).
    expect(output.score).toBeGreaterThan(0);
    expect(output.score).toBeLessThan(60);
    // Invariant procentual: score = prettifyDisplayScore(100 * sumPoints / sumMax)
    const sumPoints = output.rubric_breakdown?.reduce((s, r) => s + r.points, 0) ?? 0;
    const sumMax = output.rubric_breakdown?.reduce((s, r) => s + r.maxPoints, 0) ?? 0;
    expect(output.score).toBe(sumMax > 0 ? Math.round(100 * sumPoints / sumMax) : 0);
  });

  // Test 3: AI inventează criterii de mecanică, baremul are a) și b) → criteriile inventate sunt ignorate
  it("Test 3 — criterii inventate de AI cu normalizare: A-D mecanică → output conține doar a) și b)", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A. Reprezentarea forțelor", points: 10, maxPoints: 25, notes: "Forțele sunt corecte. Rezultat: 10p." },
        { label: "B. Ecuațiile de echilibru", points: 10, maxPoints: 25, notes: "Ecuațiile sunt corecte. Rezultat: 10p." },
        { label: "C. Substituții numerice", points: 10, maxPoints: 25, notes: "Substituțiile sunt corecte. Rezultat: 10p." },
        { label: "D. Evaluare numerică finală", points: 10, maxPoints: 25, notes: "Evaluarea este corectă. Rezultat: 10p." },
      ],
    });

    const output = alignReadableGradingResult(input, 100, undefined, {
      gradingRubric: BAREM_A_SI_B,
    });

    // Outputul trebuie să conțină exact 2 rânduri (a și b din barem)
    expect(output.rubric_breakdown?.length).toBe(2);
    // Niciun criteriu inventat (A., B., C., D.) nu trebuie să rămână
    expect(output.rubric_breakdown?.every((r) => /[ab]\)/i.test(r.label))).toBe(true);
    // sum(maxPoints) trebuie să fie 100
    const sumMax = output.rubric_breakdown?.reduce((s, r) => s + r.maxPoints, 0) ?? 0;
    expect(sumMax).toBe(100);
  });

  // Test 4: AI returnează etichete duplicate → output nu are duplicate
  it("Test 4 — deduplicare etichete: 2 rânduri cu același label → 1 rând în output", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        rand_rb("a) Calculul forței", 30, 50),
        rand_rb("a) Calculul forței", 20, 50),
      ],
    });

    const output = alignReadableGradingResult(input, 100);

    // Nu trebuie să existe rânduri cu același label
    const labels = output.rubric_breakdown?.map((r) => r.label.trim().toLowerCase()) ?? [];
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
    // Verificare explicită că nu există duplicate cu exact același text
    expect(labels.filter((l) => l === "a) calculul forței").length).toBeLessThanOrEqual(1);
  });

  // Test 5: barem din imagine fără text extras → rând generic de fallback
  it("Test 5 — fallback barem imagine: useImageBasedRubric=true fără gradingRubric → un singur rând 'Conform baremului atașat'", () => {
    const input = rezultatReadable({
      score: 70,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("A. Forța", 35, 50),
        rand_rb("B. Accelerația", 35, 50),
      ],
    });

    const output = alignReadableGradingResult(input, 100, undefined, {
      useImageBasedRubric: true,
      // gradingRubric lipsă intenționat — extragerea a eșuat
    });

    // Trebuie să existe exact un rând generic
    expect(output.rubric_breakdown?.length).toBe(1);
    expect(output.rubric_breakdown?.[0]?.label).toBe("Conform baremului atașat");
    expect(output.rubric_breakdown?.[0]?.maxPoints).toBe(100);
    // Punctele câștigate ≥ 0 și ≤ maxScore
    expect(output.rubric_breakdown?.[0]?.points).toBeGreaterThanOrEqual(0);
    expect(output.rubric_breakdown?.[0]?.points).toBeLessThanOrEqual(100);
  });

  // Test 6: invariant — output.score === sum(rubric_breakdown[].points) mereu
  it("Test 6 — invariant scor: output.score trebuie să fie egal cu suma punctelor din rubric_breakdown", () => {
    const cases = [
      rezultatReadable({
        score: 50,
        rubric_breakdown: [rand_rb("a) Prima parte", 30, 60), rand_rb("b) A doua parte", 20, 40)],
        attempted_subparts: ["A", "B"],
      }),
      rezultatReadable({
        score: 100,
        rubric_breakdown: [rand_rb("a) Test", 1, 50), rand_rb("b) Test", 2, 50)],
        attempted_subparts: ["A", "B"],
      }),
      rezultatReadable({
        score: 0,
        rubric_breakdown: [
          { label: "a) Forța", points: 0, maxPoints: 50, notes: "Neabordat: nu apare în lucrare." },
          { label: "b) Accelerația", points: 0, maxPoints: 50, notes: "Neabordat: nu apare în lucrare." },
        ],
        attempted_subparts: [],
      }),
    ];

    for (const input of cases) {
      const output = alignReadableGradingResult(input, 100);
      const sumPoints = output.rubric_breakdown?.reduce((s, r) => s + r.points, 0) ?? 0;
      expect(output.score).toBe(sumPoints);
    }
  });
});

// ─── Teste deterministe pentru scenariul live raportat ──────────────────────

describe("rubricSections prioritar față de AI — scenariu raportat maxScore=4", () => {
  const BAREM_4PTS = `Rubric (max 4 total) — apply all sections:

Section 1: a) Subpunctul a — max 2 points

Section 2: b) Subpunctul b — max 2 points`;

  it("AI returnează 2/50+2/50 cu etichete inventate → rubricSections impuse, scor mic (≈4%)", () => {
    // Scenariul exact raportat: maxScore=4, UI afișa scor=4, breakdown era pe /50
    // Cu Phase 3: fracție 2/50=4% → rawEarned=0.08 per secțiune → displayScore=4 (4%)
    const input = rezultatReadable({
      score: 4,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A) Reprezentarea forțelor", points: 2, maxPoints: 50, notes: "Forțele sunt corecte. 2p." },
        { label: "B) Reprezentarea forțelor", points: 2, maxPoints: 50, notes: "Forțele sunt corecte. 2p." },
      ],
    });

    const output = alignReadableGradingResult(input, 4, undefined, {
      gradingRubric: BAREM_4PTS,
    });

    // sum(maxPoints) == 4 (secțiunile din barem, nu AI)
    const sumMax = output.rubric_breakdown?.reduce((s, r) => s + r.maxPoints, 0) ?? 0;
    expect(sumMax).toBe(4);

    // Exact 2 rânduri — din rubricSections, nu AI
    expect(output.rubric_breakdown?.length).toBe(2);

    // Eticheta AI „Reprezentarea forțelor" nu apare în output
    const labels = output.rubric_breakdown?.map((r) => r.label.toLowerCase()) ?? [];
    expect(labels.some((l) => l.includes("reprezentarea"))).toBe(false);

    // Nu există duplicate labels
    const uniqueLabels = new Set(labels.map((l) => l.trim()));
    expect(uniqueLabels.size).toBe(labels.length);

    // 2/50 = 4% per criteriu → rawEarned = 0.04 × 2 = 0.08 (float, nu 0 exact)
    const rowA = output.rubric_breakdown?.find((r) => /a\)/i.test(r.label));
    const rowB = output.rubric_breakdown?.find((r) => /b\)/i.test(r.label));
    expect(rowA?.maxPoints).toBe(2);
    expect(rowB?.maxPoints).toBe(2);
    expect(rowA?.points).toBeLessThan(0.2);
    expect(rowB?.points).toBeLessThan(0.2);

    // scorul este procentual: prettifyDisplayScore(100 * 0.16 / 4) = 4 (nu 100%)
    expect(output.score).toBeLessThan(10);
    expect(output.score).toBeLessThan(100);
  });

  it("duplicate labels în output sunt interzise", () => {
    const input = rezultatReadable({
      score: 4,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A) Reprezentarea forțelor", points: 2, maxPoints: 50, notes: "Corect. 2p." },
        { label: "B) Reprezentarea forțelor", points: 2, maxPoints: 50, notes: "Corect. 2p." },
      ],
    });

    const output = alignReadableGradingResult(input, 4, undefined, {
      gradingRubric: BAREM_4PTS,
    });

    const labels = output.rubric_breakdown?.map((r) => r.label.trim().toLowerCase()) ?? [];
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("result.score din AI (=4) nu înseamnă 100% când rubricSections dau fracție mică", () => {
    const input = rezultatReadable({
      score: 4, // AI vrea 4/4 = 100%, dar fracția reală e 2/50 = 4%
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A) Reprezentarea forțelor", points: 2, maxPoints: 50, notes: "OK. 2p." },
        { label: "B) Reprezentarea forțelor", points: 2, maxPoints: 50, notes: "OK. 2p." },
      ],
    });

    const output = alignReadableGradingResult(input, 4, undefined, {
      gradingRubric: BAREM_4PTS,
    });

    // Fracția reală 4% → displayScore ≪ 50 (nu 100%, nu 4/4)
    expect(output.score).toBeLessThan(50);
    expect(output.score).not.toBe(100);
  });
});

// ─── Teste arhitecturale — contractul fix al baremului ────────────────────────

describe("contract fix barem — criterii inventate și bareme din imagini", () => {
  it("Test 1: AI inventează criterii, elevul rezolvă doar a) → output conține a) și b), b)=0, scor≤50", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        { label: "A. Reprezentarea forțelor", points: 25, maxPoints: 25, notes: "Forțele sunt reprezentate corect. 25p." },
        { label: "B. Ecuațiile de echilibru", points: 25, maxPoints: 25, notes: "Ecuațiile sunt corecte. 25p." },
        { label: "C. Substituții numerice", points: 25, maxPoints: 25, notes: "Valorile sunt substituite. 25p." },
        { label: "D. Rezultat final", points: 25, maxPoints: 25, notes: "Rezultatul este corect. 25p." },
      ],
    });

    const output = alignReadableGradingResult(input, 100, undefined, {
      gradingRubric: BAREM_A_SI_B,
    });

    expect(output.rubric_breakdown?.length).toBe(2);
    const rowA = output.rubric_breakdown?.find((r) => /a\)/i.test(r.label));
    const rowB = output.rubric_breakdown?.find((r) => /b\)/i.test(r.label));
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    expect(rowB?.points).toBe(0);
    expect(output.score).toBeLessThanOrEqual(50);
    expect(output.score).toBeGreaterThan(0);
  });

  it("Test 2: useImageBased=true cu text barem extras valid → reconcilierea rulează, criterii inventate ignorate", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A. Reprezentarea forțelor", points: 25, maxPoints: 25, notes: "Corect. 25p." },
        { label: "B. Ecuațiile de echilibru", points: 25, maxPoints: 25, notes: "Corect. 25p." },
        { label: "C. Substituții numerice", points: 25, maxPoints: 25, notes: "Corect. 25p." },
        { label: "D. Rezultat final", points: 25, maxPoints: 25, notes: "Corect. 25p." },
      ],
    });

    // useImageBasedRubric=true DAR gradingRubric conține text real extras din imagine
    const output = alignReadableGradingResult(input, 100, undefined, {
      useImageBasedRubric: true,
      gradingRubric: BAREM_A_SI_B,
    });

    // Reconcilierea rulează → A-D inventate sunt ignorate, rămân exact a) și b)
    expect(output.rubric_breakdown?.length).toBe(2);
    const rowA = output.rubric_breakdown?.find((r) => /a\)/i.test(r.label));
    const rowB = output.rubric_breakdown?.find((r) => /b\)/i.test(r.label));
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    expect(output.rubric_breakdown?.find((r) => /^A\./.test(r.label))).toBeUndefined();
    expect(output.rubric_breakdown?.find((r) => /^C\./.test(r.label))).toBeUndefined();
  });

  it("Test 3: AI returnează A-D criterii de mecanică, baremul are a) și b) → A-D ignorate complet", () => {
    const input = rezultatReadable({
      score: 100,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        { label: "A. Reprezentarea forțelor", points: 25, maxPoints: 25, notes: "Forțele sunt reprezentate corect. 25p." },
        { label: "B. Ecuațiile de echilibru", points: 25, maxPoints: 25, notes: "Ecuațiile sunt corecte. 25p." },
        { label: "C. Substituții numerice", points: 25, maxPoints: 25, notes: "Valorile sunt substituite corect. 25p." },
        { label: "D. Evaluare numerică finală", points: 25, maxPoints: 25, notes: "Evaluarea numerică este corectă. 25p." },
      ],
    });

    const output = alignReadableGradingResult(input, 100, undefined, {
      gradingRubric: BAREM_A_SI_B,
    });

    // Niciun criteriu A., B., C., D. din mecanică nu trebuie să apară
    expect(output.rubric_breakdown?.find((r) => /^A\./.test(r.label))).toBeUndefined();
    expect(output.rubric_breakdown?.find((r) => /^B\./.test(r.label))).toBeUndefined();
    expect(output.rubric_breakdown?.find((r) => /^C\./.test(r.label))).toBeUndefined();
    expect(output.rubric_breakdown?.find((r) => /^D\./.test(r.label))).toBeUndefined();

    // Outputul final conține exact a) și b) din barem
    expect(output.rubric_breakdown?.length).toBe(2);
    expect(output.rubric_breakdown?.every((r) => /[ab]\)/i.test(r.label))).toBe(true);
  });
});

// ─── Teste prettifyDisplayScore ───────────────────────────────────────────────

describe("prettifyDisplayScore — rotunjire la valori frumoase", () => {
  it("exact 50 → 50", () => expect(prettifyDisplayScore(50)).toBe(50));
  it("49 → 50 (diferență 1 ≤ 1.5)", () => expect(prettifyDisplayScore(49)).toBe(50));
  it("48.6 → 50 (diferență 1.4 ≤ 1.5)", () => expect(prettifyDisplayScore(48.6)).toBe(50));
  it("48.4 → 48 (diferență 1.6 > 1.5)", () => expect(prettifyDisplayScore(48.4)).toBe(48));
  it("75 → 75", () => expect(prettifyDisplayScore(75)).toBe(75));
  it("73.5 → 75 (diferență 1.5 ≤ 1.5)", () => expect(prettifyDisplayScore(73.5)).toBe(75));
  it("73.4 → 73 (diferență 1.6 > 1.5)", () => expect(prettifyDisplayScore(73.4)).toBe(73));
  it("98.5 → 100 (diferență 1.5 ≤ 1.5)", () => expect(prettifyDisplayScore(98.5)).toBe(100));
  it("100 → 100", () => expect(prettifyDisplayScore(100)).toBe(100));
  it("0 → 0", () => expect(prettifyDisplayScore(0)).toBe(0));
  it("4 → 4 (nu e aproape de nicio valoare frumoasă)", () => expect(prettifyDisplayScore(4)).toBe(4));
  it("30 → 30", () => expect(prettifyDisplayScore(30)).toBe(30));
});

// ─── Teste pipeline cu scară brută (Phase 3) ──────────────────────────────────

const BAREM_RAW_4 = `Rubric (max 4 total) — apply all sections:

Section 1: a) Subpunctul a — max 2 points

Section 2: b) Subpunctul b — max 2 points`;

const BAREM_RAW_10 = `Rubric (max 10 total) — apply all sections:

Section 1: a) Prima cerință — max 3 points

Section 2: b) A doua cerință — max 4 points

Section 3: c) A treia cerință — max 3 points`;

describe("pipeline cu scară brută — displayScore procentual", () => {
  it("AI acordă 2/2+2/2 pe barem /4 → displayScore=100", () => {
    const input = rezultatReadable({
      score: 4,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("a) Subpunctul a", 2, 2),
        rand_rb("b) Subpunctul b", 2, 2),
      ],
    });
    const output = alignReadableGradingResult(input, 4, undefined, { gradingRubric: BAREM_RAW_4 });
    expect(output.score).toBe(100);
  });

  it("AI acordă 1/2+2/2 pe barem /4 → displayScore=75 (prettify 75)", () => {
    const input = rezultatReadable({
      score: 3,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("a) Subpunctul a", 1, 2),
        rand_rb("b) Subpunctul b", 2, 2),
      ],
    });
    const output = alignReadableGradingResult(input, 4, undefined, { gradingRubric: BAREM_RAW_4 });
    // 3/4 = 75% → prettifyDisplayScore(75) = 75
    expect(output.score).toBe(75);
  });

  it("AI acordă 0/2+0/2 pe barem /4 → displayScore=0", () => {
    const input = rezultatReadable({
      score: 0,
      attempted_subparts: [],
      rubric_breakdown: [
        { label: "a) Subpunctul a", points: 0, maxPoints: 2, notes: "Neabordat: lipsă." },
        { label: "b) Subpunctul b", points: 0, maxPoints: 2, notes: "Neabordat: lipsă." },
      ],
    });
    const output = alignReadableGradingResult(input, 4, undefined, { gradingRubric: BAREM_RAW_4 });
    expect(output.score).toBe(0);
  });

  it("barem /10: AI acordă 3/3+2/4+0/3 → displayScore=50 (prettify 50)", () => {
    const input = rezultatReadable({
      score: 5,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("a) Prima cerință", 3, 3),
        rand_rb("b) A doua cerință", 2, 4),
        { label: "c) A treia cerință", points: 0, maxPoints: 3, notes: "Neabordat: lipsă." },
      ],
    });
    const output = alignReadableGradingResult(input, 100, undefined, { gradingRubric: BAREM_RAW_10 });
    // 5/10 = 50% → prettifyDisplayScore(50) = 50
    expect(output.score).toBe(50);
  });

  it("barem /10: AI acordă 3/3+4/4+3/3 → displayScore=100", () => {
    const input = rezultatReadable({
      score: 10,
      attempted_subparts: ["A", "B", "C"],
      rubric_breakdown: [
        rand_rb("a) Prima cerință", 3, 3),
        rand_rb("b) A doua cerință", 4, 4),
        rand_rb("c) A treia cerință", 3, 3),
      ],
    });
    const output = alignReadableGradingResult(input, 100, undefined, { gradingRubric: BAREM_RAW_10 });
    expect(output.score).toBe(100);
  });

  it("AI la scara /50 pe barem /4: 25/50+25/50 → displayScore=50 (50%)", () => {
    // AI a ales /50 scale, barem are /4. Fracție 50% → displayScore=50.
    const input = rezultatReadable({
      score: 50,
      attempted_subparts: ["A", "B"],
      rubric_breakdown: [
        rand_rb("a) Subpunctul a", 25, 50),
        rand_rb("b) Subpunctul b", 25, 50),
      ],
    });
    const output = alignReadableGradingResult(input, 4, undefined, { gradingRubric: BAREM_RAW_4 });
    // 25/50 = 50% per criteriu → rawEarned per criteriu = 0.5*2 = 1.0 → total 2/4 = 50%
    expect(output.score).toBe(50);
  });

  it("AI acordă 49/50 pe a), 0/50 pe b), barem a=2,b=2 → displayScore=50 (prettify din 49%)", () => {
    // 49/50 = 98% din a → rawEarned_a = 0.98*2 = 1.96
    // 0/50 = 0% din b → rawEarned_b = 0
    // total: 1.96/4 = 49% → prettifyDisplayScore(49) = 50
    const input = rezultatReadable({
      score: 49,
      attempted_subparts: ["A"],
      rubric_breakdown: [
        rand_rb("a) Subpunctul a", 49, 50),
        { label: "b) Subpunctul b", points: 0, maxPoints: 50, notes: "Neabordat: lipsă." },
      ],
    });
    const output = alignReadableGradingResult(input, 4, undefined, { gradingRubric: BAREM_RAW_4 });
    expect(output.score).toBe(50);
  });

  it("invariant: score = prettifyDisplayScore(100 * sum(points) / sum(maxPoints)) pentru calea rubricSections", () => {
    const cases = [
      { a: [1, 2], b: [2, 2] },
      { a: [0, 2], b: [1, 2] },
      { a: [2, 2], b: [0, 2] },
    ] as { a: [number, number]; b: [number, number] }[];

    for (const c of cases) {
      const input = rezultatReadable({
        score: c.a[0] + c.b[0],
        attempted_subparts: ["A", "B"],
        rubric_breakdown: [
          rand_rb("a) Subpunctul a", c.a[0], c.a[1]),
          rand_rb("b) Subpunctul b", c.b[0], c.b[1]),
        ],
      });
      const output = alignReadableGradingResult(input, 4, undefined, { gradingRubric: BAREM_RAW_4 });
      const sumPts = output.rubric_breakdown?.reduce((s, r) => s + r.points, 0) ?? 0;
      const sumMax = output.rubric_breakdown?.reduce((s, r) => s + r.maxPoints, 0) ?? 0;
      const expected = sumMax > 0 ? prettifyDisplayScore(100 * sumPts / sumMax) : 0;
      expect(output.score).toBe(expected);
    }
  });
});
