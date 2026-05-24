import { describe, it, expect } from "vitest";
import {
  computeSimpleScore,
  validateSimpleResult,
  type SimpleGraderResult,
} from "@/lib/ai/grader-simple";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeReadable(overrides: Partial<SimpleGraderResult> = {}): SimpleGraderResult {
  return {
    readability: "readable",
    rejection_reason: null,
    total_barem: 5,
    puncte_obtinute: 2,
    criterii: [
      { label: "a) calculul vitezei", puncte_maxime: 3, puncte_obtinute: 2, ce_a_fost_corect: "formula corectă", ce_lipseste_sau_e_gresit: "lipsește unitatea" },
      { label: "b) forța de frecare", puncte_maxime: 2, puncte_obtinute: 0, ce_a_fost_corect: "", ce_lipseste_sau_e_gresit: "neabordat" },
    ],
    feedback_general: "Rezolvare parțială.",
    puncte_forte: ["formula vitezei aplicată corect"],
    de_imbunatatit: ["adaugă unitățile de măsură", "rezolvă și subpunctul b)"],
    ...overrides,
  };
}

// ─── computeSimpleScore ───────────────────────────────────────────────────────

describe("computeSimpleScore", () => {
  it("Test 1 — barem 5p, elev ia 2p → scor 40", () => {
    expect(computeSimpleScore(2, 5)).toBe(40);
  });

  it("Test 2 — barem 4p, elev ia 2p → scor 50", () => {
    expect(computeSimpleScore(2, 4)).toBe(50);
  });

  it("Test 3 — barem 4p, elev ia 4p → scor 100", () => {
    expect(computeSimpleScore(4, 4)).toBe(100);
  });

  it("scor 0 când puncte_obtinute = 0", () => {
    expect(computeSimpleScore(0, 10)).toBe(0);
  });

  it("total_barem = 0 → returnează 0 fără excepție", () => {
    expect(computeSimpleScore(0, 0)).toBe(0);
  });

  it("rotunjire: 1/3 → 33", () => {
    expect(computeSimpleScore(1, 3)).toBe(33);
  });
});

// ─── validateSimpleResult ─────────────────────────────────────────────────────

describe("validateSimpleResult", () => {
  it("result valid → { valid: true }", () => {
    const r = makeReadable();
    expect(validateSimpleResult(r)).toEqual({ valid: true });
  });

  it("Test 4 — criteriu lipsă: puncte_obtinute=0 și explicație prezentă", () => {
    const r = makeReadable({
      puncte_obtinute: 2,
      criterii: [
        { label: "a)", puncte_maxime: 3, puncte_obtinute: 2, ce_a_fost_corect: "corect", ce_lipseste_sau_e_gresit: "" },
        { label: "b)", puncte_maxime: 2, puncte_obtinute: 0, ce_a_fost_corect: "", ce_lipseste_sau_e_gresit: "neabordat de elev" },
      ],
    });
    const v = validateSimpleResult(r);
    expect(v.valid).toBe(true);
    // verificăm că criteriul b) are puncte_obtinute=0 și explicație
    const critB = r.criterii.find((c) => c.label === "b)");
    expect(critB?.puncte_obtinute).toBe(0);
    expect(critB?.ce_lipseste_sau_e_gresit.length).toBeGreaterThan(0);
  });

  it("Test 5 — scor_procentual greșit de la AI: codul recalculează corect", () => {
    // AI ar putea returna scor_procentual incorect (e.g. 80 în loc de 40).
    // computeSimpleScore ignoră scor_procentual și recalculează din date brute.
    expect(computeSimpleScore(2, 5)).toBe(40); // corect, indiferent de ce zice AI
    expect(computeSimpleScore(4, 5)).toBe(80); // alt exemplu
    // Scorul e MEREU recalculat din puncte_obtinute / total_barem, nu din scor_procentual.
  });

  it("Test 6 — puncte_obtinute > total_barem → validare pică cu mesaj clar", () => {
    const r = makeReadable({ total_barem: 4, puncte_obtinute: 5 });
    const v = validateSimpleResult(r);
    expect(v.valid).toBe(false);
    expect((v as { valid: false; reason: string }).reason).toMatch(/puncte_obtinute.*>.*total_barem/);
  });

  it("total_barem = 0 → validare pică", () => {
    const r = makeReadable({ total_barem: 0 });
    const v = validateSimpleResult(r);
    expect(v.valid).toBe(false);
    expect((v as { valid: false; reason: string }).reason).toMatch(/total_barem/);
  });

  it("total_barem null → validare pică", () => {
    const r = makeReadable({ total_barem: null });
    const v = validateSimpleResult(r);
    expect(v.valid).toBe(false);
  });

  it("criteriu cu puncte_obtinute > puncte_maxime → validare pică", () => {
    const r = makeReadable({
      total_barem: 5,
      puncte_obtinute: 4,
      criterii: [
        { label: "a)", puncte_maxime: 3, puncte_obtinute: 4, ce_a_fost_corect: "ok", ce_lipseste_sau_e_gresit: "" },
        { label: "b)", puncte_maxime: 2, puncte_obtinute: 0, ce_a_fost_corect: "", ce_lipseste_sau_e_gresit: "lipsă" },
      ],
    });
    const v = validateSimpleResult(r);
    expect(v.valid).toBe(false);
    expect((v as { valid: false; reason: string }).reason).toMatch(/puncte_obtinute.*>.*puncte_maxime/);
  });

  it("suma criteriilor diferă prea mult de puncte_obtinute → validare pică", () => {
    const r = makeReadable({
      total_barem: 5,
      puncte_obtinute: 4,
      criterii: [
        // suma = 1 ≠ 4
        { label: "a)", puncte_maxime: 3, puncte_obtinute: 1, ce_a_fost_corect: "ok", ce_lipseste_sau_e_gresit: "" },
        { label: "b)", puncte_maxime: 2, puncte_obtinute: 0, ce_a_fost_corect: "", ce_lipseste_sau_e_gresit: "lipsă" },
      ],
    });
    const v = validateSimpleResult(r);
    expect(v.valid).toBe(false);
    expect((v as { valid: false; reason: string }).reason).toMatch(/suma criteriilor/);
  });

  it("rejected → valid fără alte verificări", () => {
    const r: SimpleGraderResult = {
      readability: "rejected",
      rejection_reason: "Imagine neclară.",
      total_barem: null,
      puncte_obtinute: null,
      criterii: [],
      feedback_general: null,
      puncte_forte: [],
      de_imbunatatit: [],
    };
    expect(validateSimpleResult(r)).toEqual({ valid: true });
  });
});
