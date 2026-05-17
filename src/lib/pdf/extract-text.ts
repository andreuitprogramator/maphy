import { readFile } from "fs/promises";
import path from "path";

function pdfUrlToDiskPath(pdfUrl: string) {
  const clean = pdfUrl.startsWith("/") ? pdfUrl.slice(1) : pdfUrl;
  return path.join(process.cwd(), "public", ...clean.split("/"));
}

export async function extractPdfTextFromPublicUrl(pdfUrl: string | null | undefined): Promise<string | null> {
  if (!pdfUrl) return null;
  if (!pdfUrl.startsWith("/")) return null;
  try {
    const diskPath = pdfUrlToDiskPath(pdfUrl);
    const bytes = await readFile(diskPath);
    const mod = await import("pdf-parse");
    const pdfParse = (mod as unknown as { default: (buffer: Buffer) => Promise<{ text?: string }> }).default;
    const parsed = await pdfParse(bytes);
    const text = (parsed.text ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

