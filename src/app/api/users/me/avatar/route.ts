import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { jsonError, jsonOk } from "@/lib/api/response";
import { storage } from "@/lib/storage/driver";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const me = await requireUser();
  if (!me) return jsonError(401, "Not authenticated");

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Date formular invalide");

  const file = form.get("avatar");
  if (!(file instanceof File)) return jsonError(400, "Missing image");
  if (!file.type.startsWith("image/")) return jsonError(400, "File must be an image");
  if (file.size > MAX_BYTES) return jsonError(400, "Image too large (max 4MB)");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored = await storage.saveImage({
    bytes,
    filename: file.name || "avatar.jpg",
    folder: `avatars/${me.id}`,
  });

  const user = await prisma.user.update({
    where: { id: me.id },
    data: { avatarUrl: stored.publicUrl },
    select: { avatarUrl: true, username: true },
  });

  return jsonOk({ avatarUrl: user.avatarUrl, username: user.username });
}
