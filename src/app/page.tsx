import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getSessionUser();
  return (
    <Container className="py-10 sm:py-14">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10 items-start">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Exersează olimpiade de matematică, fizică și chimie — subiecte oficiale, corectare automată prin AI.
          </h1>
          <p className="text-zinc-600 leading-relaxed">
            Maphy îți permite să exersezi subiecte de olimpiadă reale, să trimiți rezolvări foto și să primești feedback imediat de la AI.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/math">
              <Button size="lg" className="bg-violet-600 text-white hover:bg-violet-700">Matematică</Button>
            </Link>
            <Link href="/physics">
              <Button size="lg" className="bg-sky-600 text-white hover:bg-sky-700">Fizică</Button>
            </Link>
            <Link href="/chemistry">
              <Button size="lg" className="bg-green-600 text-white hover:bg-green-700">Chimie</Button>
            </Link>
            {!user ? (
              <Link href="/register">
                <Button size="lg" variant="secondary">
                  Creează cont
                </Button>
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-zinc-500">
            Sfat: Pe mobil, poți încărca direct din galerie sau cameră.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="text-sm font-medium text-zinc-900">Ce oferă Maphy</div>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm text-zinc-700">
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]" />
                Subiecte oficiale de olimpiadă grupate (3 probleme + PDF subiect)
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]" />
                Filtrare după an, etapă (locală / județeană / națională) și clasă
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]" />
                Trimite foto cu rezolvarea — AI-ul corectează pe baza baremului oficial
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
