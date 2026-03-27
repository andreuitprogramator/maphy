import "dotenv/config";
import { PrismaClient, Subject, Phase } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const count = await prisma.problem.count();
  if (count > 0) return;

  await prisma.problem.create({
    data: {
      title: "Geometry warm-up: Angle chase",
      subject: Subject.MATH,
      difficulty: 4,
      year: 2024,
      class: 9,
      phase: Phase.COUNTY,
      statement:
        "Let ABC be a triangle with \u2220A = 60\u00b0. Points D and E lie on segments AB and AC respectively such that AD = AE.\n" +
        "Prove that \u2220BDC = \u2220CEC.\n\n" +
        "(Upload a photo of your solution as a submission.)",
    },
  });
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

