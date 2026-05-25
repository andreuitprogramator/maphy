import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { PDFParse } from "pdf-parse";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { jsonError, jsonOk } from "@/lib/api/response";

const BodySchema = z.object({
  url: z.string().min(1),
});

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "url invalid");

  const { url } = parsed.data;

  let data: Uint8Array;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url);
      if (!res.ok) return jsonError(400, "Nu s-a putut descărca PDF-ul.");
      data = new Uint8Array(await res.arrayBuffer());
    } else if (url.startsWith("/")) {
      const diskPath = path.join(process.cwd(), "public", ...url.slice(1).split("/"));
      const buf = await readFile(diskPath);
      data = new Uint8Array(buf);
    } else {
      return jsonError(400, "URL invalid.");
    }
  } catch {
    return jsonError(400, "Nu s-a putut citi PDF-ul.");
  }

  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return jsonOk({ text: result.text.trim() });
  } catch (err) {
    console.error("[extract-pdf-text] error:", err);
    return jsonError(500, "Extragerea textului a eșuat.");
  } finally {
    await parser.destroy().catch(() => {});
  }
}
