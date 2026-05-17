import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { Container } from "@/components/layout/container";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();
  if (!teacher) redirect("/");

  return (
    <Container className="py-8">
      <div className="mb-8 flex flex-col gap-2 border-b border-zinc-200 pb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Teacher workspace</div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            className="rounded-lg px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            href="/teacher"
          >
            Dashboard
          </Link>
          <Link
            className="rounded-lg px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            href="/teacher/problems"
          >
            My problems
          </Link>
          <Link
            className="rounded-lg px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            href="/teacher/contest-sets"
          >
            Contest sets
          </Link>
          <Link
            className="rounded-lg bg-[color:var(--accent)] px-3 py-2 font-medium text-white hover:bg-[color:var(--accent-2)]"
            href="/teacher/problems/new"
          >
            New problem
          </Link>
          <Link
            className="rounded-lg bg-zinc-900 px-3 py-2 font-medium text-white hover:bg-zinc-800"
            href="/teacher/contest-sets/new"
          >
            New contest set
          </Link>
        </nav>
      </div>
      {children}
    </Container>
  );
}
