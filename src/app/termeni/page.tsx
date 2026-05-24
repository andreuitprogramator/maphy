import { Container } from "@/components/layout/container";

export const metadata = { title: "Termeni și condiții — Maphy" };

export default function TermeniPage() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl prose prose-zinc">
        <h1 className="text-2xl font-bold mb-2">Termeni și condiții</h1>
        <p className="text-sm text-zinc-500 mb-8">Ultima actualizare: mai 2025</p>

        <h2 className="text-lg font-semibold mt-8 mb-2">1. Despre platformă</h2>
        <p className="text-sm text-zinc-700">
          Maphy este o platformă educațională destinată pregătirii pentru olimpiadele de matematică,
          fizică și chimie. Prin utilizarea platformei, accepți prezentele condiții de utilizare.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">2. Conturi</h2>
        <p className="text-sm text-zinc-700">
          Pentru a utiliza funcționalitățile complete ale platformei, trebuie să îți creezi un cont
          cu o adresă de email validă. Ești responsabil de confidențialitatea parolei și de
          activitatea desfășurată în contul tău. Ne rezervăm dreptul de a suspenda conturile care
          încalcă acești termeni.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">3. Conținut și submisii</h2>
        <p className="text-sm text-zinc-700">
          Prin trimiterea unei rezolvări, acorzi platformei Maphy dreptul de a o stoca și afișa în
          scop educațional. Nu este permisă încărcarea de conținut ofensator, plagiat sau care
          încalcă drepturile de autor. Problemele și baremele afișate pe platformă sunt preluate din
          surse publice sau create de echipa Maphy.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">4. Notare automată cu AI</h2>
        <p className="text-sm text-zinc-700">
          Notarea submisiilor se realizează automat prin intermediul inteligenței artificiale.
          Scorurile sunt orientative și pot conține erori. Maphy nu garantează acuratețea absolută a
          notării automate.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">5. Limitarea răspunderii</h2>
        <p className="text-sm text-zinc-700">
          Platforma este oferită „ca atare", fără garanții de disponibilitate continuă. Maphy nu
          răspunde pentru nicio pierdere directă sau indirectă rezultată din utilizarea platformei.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">6. Modificări</h2>
        <p className="text-sm text-zinc-700">
          Ne rezervăm dreptul de a modifica acești termeni oricând. Continuarea utilizării
          platformei după publicarea modificărilor constituie acceptarea lor.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">7. Contact</h2>
        <p className="text-sm text-zinc-700">
          Pentru întrebări legate de acești termeni, ne poți contacta la{" "}
          <a href="mailto:ascend.edu123@gmail.com" className="text-[color:var(--accent)] hover:underline">
            ascend.edu123@gmail.com
          </a>
          .
        </p>
      </div>
    </Container>
  );
}
