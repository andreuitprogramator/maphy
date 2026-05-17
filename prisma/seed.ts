import "dotenv/config";
import { PrismaClient, Subject, Phase } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const problems = [
      {
        title: "Geometry: Equal chords, equal angles",
        subject: Subject.MATH,
        difficulty: 4,
        year: 2024,
        class: 9,
        phase: Phase.COUNTY,
        statement:
          "Let ABC be a triangle with ∠A = 60°. Points D and E lie on segments AB and AC respectively such that AD = AE.\n" +
          "Prove that ∠BDC = ∠CEC.\n",
        officialSolution:
          "Because AD = AE and ∠DAE = 60°, triangle ADE is equilateral after a 60° rotation about A.\n" +
          "Let R be the rotation of angle 60° around A sending ray AB to ray AC. Then R(D) lies on AC and satisfies AR(D)=AD, hence R(D)=E.\n" +
          "The rotation sends line DC to line EC and preserves angles. Therefore ∠BDC = ∠(R(B) R(D) R(C)) = ∠CEC.",
        gradingRubric:
          "Rubric (max 100):\n" +
          "- (20) Identify/use a 60° rotation about A (or construct equilateral triangle on AD/AE)\n" +
          "- (25) Correctly map D → E under the rotation (or equivalent argument)\n" +
          "- (25) Show corresponding rays/lines map (DC ↔ EC, DB ↔? ) and invoke angle preservation\n" +
          "- (20) Conclude ∠BDC = ∠CEC clearly with correct orientation\n" +
          "- (10) Clarity, correct notation, no logical gaps",
        maxScore: 100,
        expectedConcepts: ["rotation", "equilateral triangle", "angle preservation", "geometry"],
      },
      {
        title: "Number theory: A divisibility invariant",
        subject: Subject.MATH,
        difficulty: 5,
        year: 2023,
        class: 10,
        phase: Phase.NATIONAL,
        statement:
          "Find all integers n such that n^2 + n + 1 divides n^4 + 1.\n",
        officialSolution:
          "Let d = n^2 + n + 1. Work modulo d. Note that n^2 ≡ -n - 1 (mod d).\n" +
          "Then n^3 ≡ n·n^2 ≡ n(-n-1) ≡ -n^2 - n ≡ -(-n-1) - n ≡ 1 (mod d).\n" +
          "So n^6 ≡ 1. Also n^4 + 1 = n·n^3 + 1? Better: compute n^4 ≡ n·n^3 ≡ n (mod d).\n" +
          "Thus n^4 + 1 ≡ n + 1 (mod d). We need d | (n+1).\n" +
          "But d = n^2 + n + 1 > |n+1| for |n| ≥ 2, so only small n are possible.\n" +
          "Check n ∈ {-2,-1,0,1}. Values: n=-2 gives d=3, n^4+1=17 not divisible. n=-1 gives d=1 divides. n=0 gives d=1 divides. n=1 gives d=3, n^4+1=2 not divisible.\n" +
          "Hence n ∈ {-1,0}.",
        gradingRubric:
          "Rubric (max 100):\n" +
          "- (30) Work mod (n^2+n+1) and derive n^2 ≡ -n-1\n" +
          "- (25) Correctly deduce n^3 ≡ 1 and n^4 ≡ n (or equivalent reduction)\n" +
          "- (25) Reduce condition to n^2+n+1 | n+1 and justify bounding/small cases\n" +
          "- (10) Check remaining integer cases correctly\n" +
          "- (10) Clear write-up",
        maxScore: 100,
        expectedConcepts: ["modular arithmetic", "polynomial congruences", "bounding", "casework"],
      },
      {
        title: "Combinatorics: Coloring and parity",
        subject: Subject.MATH,
        difficulty: 6,
        year: 2020,
        class: 11,
        phase: Phase.LOCAL,
        statement:
          "A 7x7 board is colored black/white in checkerboard pattern. You may place dominoes covering two adjacent squares.\n" +
          "Can 24 dominoes cover all black squares? Justify your answer.\n",
        officialSolution:
          "A 7x7 board has 25 black and 24 white squares (because odd board starts/ends with same color).\n" +
          "Each domino always covers one black and one white square. Therefore 24 dominoes cover exactly 24 black squares.\n" +
          "But there are 25 black squares, so covering all black squares is impossible.",
        gradingRubric:
          "Rubric (max 100):\n" +
          "- (25) Correctly count color imbalance on 7x7 board (25 vs 24)\n" +
          "- (35) State each domino covers one black + one white\n" +
          "- (25) Derive contradiction for covering all black squares\n" +
          "- (15) Clear, logically complete conclusion",
        maxScore: 100,
        expectedConcepts: ["invariant", "parity", "checkerboard coloring"],
      },
      {
        title: "Mechanics: Inclined plane with friction",
        subject: Subject.PHYSICS,
        difficulty: 4,
        year: 2022,
        class: 9,
        phase: Phase.COUNTY,
        statement:
          "A block of mass m rests on a rough incline of angle θ with coefficient of kinetic friction μ.\n" +
          "It is released from rest and slides down a distance L. Find its speed at the bottom.\n",
        officialSolution:
          "Along the incline: net force = mg sinθ - μ mg cosθ, so acceleration a = g(sinθ - μ cosθ).\n" +
          "Using v^2 = 2aL (starting from rest): v = sqrt(2 g L (sinθ - μ cosθ)), provided sinθ > μ cosθ.",
        gradingRubric:
          "Rubric (max 100):\n" +
          "- (25) Correct free-body diagram/components (mg sinθ, mg cosθ)\n" +
          "- (25) Friction direction and magnitude μ mg cosθ\n" +
          "- (25) Correct acceleration a = g(sinθ - μ cosθ)\n" +
          "- (15) Correct kinematics (v^2 = 2aL)\n" +
          "- (10) Mention condition for sliding / physical consistency",
        maxScore: 100,
        expectedConcepts: ["Newton's laws", "friction", "kinematics", "inclined plane"],
      },
      {
        title: "E&M: Capacitor energy and charge sharing",
        subject: Subject.PHYSICS,
        difficulty: 5,
        year: 2021,
        class: 10,
        phase: Phase.NATIONAL,
        statement:
          "Two identical capacitors of capacitance C: one is charged to voltage V, the other uncharged.\n" +
          "They are connected in parallel (positive to positive). Find the final voltage and the energy lost.\n",
        officialSolution:
          "Initial charge Q = CV on the charged capacitor, total charge conserved: Q_total = CV.\n" +
          "In parallel, equivalent capacitance is 2C, so V_f = Q_total/(2C) = V/2.\n" +
          "Initial energy U_i = (1/2) C V^2. Final energy U_f = 2 * (1/2) C (V/2)^2 = (1/4) C V^2.\n" +
          "Energy lost ΔU = U_i - U_f = (1/4) C V^2 (dissipated as heat/radiation).",
        gradingRubric:
          "Rubric (max 100):\n" +
          "- (30) Use charge conservation to find V_f = V/2\n" +
          "- (30) Compute initial energy correctly\n" +
          "- (25) Compute final energy correctly for two capacitors\n" +
          "- (10) Correct energy loss expression\n" +
          "- (5) State where the energy goes physically",
        maxScore: 100,
        expectedConcepts: ["capacitance", "charge conservation", "energy in capacitors"],
      },
      {
        title: "Thermodynamics: Ideal gas two-step process",
        subject: Subject.PHYSICS,
        difficulty: 6,
        year: 2024,
        class: 11,
        phase: Phase.LOCAL,
        statement:
          "An ideal monoatomic gas goes from state A(P0,V0,T0) to B(2P0,V0) at constant volume,\n" +
          "then from B to C(2P0,2V0) at constant pressure. Compute total work and total change in internal energy from A to C.\n",
        officialSolution:
          "A->B is isochoric: W_AB = 0. Since P doubles at fixed V, T doubles: T_B = 2T0.\n" +
          "B->C is isobaric at 2P0 with volume change V0, so W_BC = PΔV = 2P0·V0.\n" +
          "For monoatomic ideal gas, U = (3/2)nRT = (3/2)PV.\n" +
          "U_A = (3/2)P0V0, U_C = (3/2)(2P0)(2V0)=6P0V0.\n" +
          "ΔU_AC = U_C - U_A = (9/2)P0V0.\n" +
          "Total work W_AC = 2P0V0.",
        gradingRubric:
          "Rubric (max 100):\n" +
          "- (20) Correctly identify A->B isochoric work = 0\n" +
          "- (20) Correctly compute B->C isobaric work = 2P0V0\n" +
          "- (25) Use U=(3/2)PV (or equivalent with nRT) for monoatomic gas\n" +
          "- (25) Correct ΔU from A to C\n" +
          "- (10) Final boxed results with units/consistency",
        maxScore: 100,
        expectedConcepts: ["ideal gas law", "work in thermodynamic processes", "internal energy"],
      },
    ];

  for (const p of problems) {
    const existing = await prisma.problem.findFirst({
      where: { title: p.title, year: p.year, class: p.class, phase: p.phase },
      select: { id: true },
    });
    if (!existing) {
      await prisma.problem.create({ data: p });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

