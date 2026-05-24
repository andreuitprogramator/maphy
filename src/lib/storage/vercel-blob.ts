import { put } from "@vercel/blob";
import type { StorageDriver, StoredFile } from "@/lib/storage";

function safeFilename(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class VercelBlobStorage implements StorageDriver {
  async saveImage(args: { bytes: Uint8Array; filename: string; folder: string }): Promise<StoredFile> {
    return this.saveFile(args);
  }

  async saveFile(args: { bytes: Uint8Array; filename: string; folder: string }): Promise<StoredFile> {
    const key = `${args.folder}/${Date.now()}-${safeFilename(args.filename)}`;
    const blob = await put(key, Buffer.from(args.bytes), { access: "public" });
    return { publicUrl: blob.url, key };
  }
}
