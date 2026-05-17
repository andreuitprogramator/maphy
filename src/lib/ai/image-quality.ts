import { readFile } from "fs/promises";
import path from "path";

type ImageQualityDecision = { ok: true } | { ok: false; reason: string };

function publicUrlToDiskPath(imageUrl: string) {
  // imageUrl is like "/uploads/solutions/..../file.jpg"
  const clean = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
  return path.join(process.cwd(), "public", ...clean.split("/"));
}

export async function assessImageQuality(imageUrl: string): Promise<ImageQualityDecision> {
  // Mock logic for now. Replace later with OCR + blur detection / LLM vision.
  const diskPath = publicUrlToDiskPath(imageUrl);
  const buf = await readFile(diskPath);

  if (buf.byteLength < 25_000) {
    return { ok: false, reason: "Image too small / likely unreadable. Please upload a clearer photo." };
  }

  // Very basic file signature checks (avoid grading non-images).
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
  if (!isPng && !isJpeg && !isWebp) {
    return { ok: false, reason: "Unsupported or corrupted image. Please re-upload." };
  }

  return { ok: true };
}

