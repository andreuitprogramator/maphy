import { Container } from "@/components/layout/container";

export const metadata = { title: "Politică de confidențialitate — Maphy" };

export default function ConfidentialitatePage() {
  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl prose prose-zinc">
        <h1 className="text-2xl font-bold mb-2">Politică de confidențialitate</h1>
        <p className="text-sm text-zinc-500 mb-8">Ultima actualizare: mai 2025</p>

        <h2 className="text-lg font-semibold mt-8 mb-2">1. Operator de date</h2>
        <p className="text-sm text-zinc-700">
          Operatorul acestei platforme este Maphy, contactabil la{" "}
          <a href="mailto:ascend.edu123@gmail.com" className="text-[color:var(--accent)] hover:underline">
            ascend.edu123@gmail.com
          </a>
          . Această politică se aplică în conformitate cu Regulamentul (UE) 2016/679 (GDPR).
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">2. Date colectate</h2>
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
          <li>Nume și prenume</li>
          <li>Adresă de email</li>
          <li>Nume de utilizator</li>
          <li>Țară și oraș (opțional)</li>
          <li>Rezolvările (imaginile) trimise pe platformă</li>
          <li>Date tehnice de acces (adresă IP, tip browser) — stocate temporar în loguri</li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-2">3. Scopul prelucrării</h2>
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
          <li>Crearea și gestionarea contului tău</li>
          <li>Trimiterea emailurilor de verificare și de resetare a parolei</li>
          <li>Notarea automată a rezolvărilor și afișarea rezultatelor</li>
          <li>Funcționarea clasamentelor și a profilurilor publice</li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-2">4. Temeiul legal</h2>
        <p className="text-sm text-zinc-700">
          Prelucrarea se bazează pe consimțământul tău (art. 6 alin. 1 lit. a GDPR), exprimat prin
          crearea contului, și pe executarea unui contract (art. 6 alin. 1 lit. b GDPR) pentru
          furnizarea serviciilor platformei.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">5. Terți</h2>
        <p className="text-sm text-zinc-700">
          Folosim următorii furnizori de servicii care pot procesa date în numele nostru:
        </p>
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
          <li>
            <strong>OpenAI</strong> — pentru notarea automată a rezolvărilor (imaginile sunt
            transmise API-ului OpenAI)
          </li>
          <li>
            <strong>Resend</strong> — pentru trimiterea emailurilor tranzacționale
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-2">6. Retenția datelor</h2>
        <p className="text-sm text-zinc-700">
          Datele sunt păstrate atât timp cât contul tău este activ. La ștergerea contului, datele
          personale sunt șterse în termen de 30 de zile, cu excepția celor necesare îndeplinirii
          unor obligații legale.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">7. Drepturile tale</h2>
        <p className="text-sm text-zinc-700">Conform GDPR, ai dreptul la:</p>
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
          <li>Acces la datele tale personale</li>
          <li>Rectificarea datelor inexacte</li>
          <li>Ștergerea datelor („dreptul de a fi uitat")</li>
          <li>Portabilitatea datelor</li>
          <li>Opoziție față de prelucrare</li>
        </ul>
        <p className="text-sm text-zinc-700 mt-2">
          Pentru exercitarea acestor drepturi, contactează-ne la{" "}
          <a href="mailto:ascend.edu123@gmail.com" className="text-[color:var(--accent)] hover:underline">
            ascend.edu123@gmail.com
          </a>
          .
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">8. Cookie-uri</h2>
        <p className="text-sm text-zinc-700">
          Platforma folosește un singur cookie esențial pentru menținerea sesiunii de autentificare.
          Nu folosim cookie-uri de tracking sau publicitate.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-2">9. Modificări</h2>
        <p className="text-sm text-zinc-700">
          Ne rezervăm dreptul de a actualiza această politică. Te vom notifica prin email în cazul
          unor modificări semnificative.
        </p>
      </div>
    </Container>
  );
}
