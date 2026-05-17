import path from "path";
import { mkdir, writeFile } from "fs/promises";
import type { StorageDriver, StoredFile } from "@/lib/storage";

function safeFilename(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function createStoredPath(args: { folder: string; filename: string }) {
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const folderSafe = args.folder.replace(/[^a-zA-Z0-9/_-]/g, "_");
  const key = path.posix.join(folderSafe.split(path.sep).join("/"), `${Date.now()}-${safeFilename(args.filename)}`);
  const diskPath = path.join(uploadsRoot, ...key.split("/"));
  const publicUrl = `/uploads/${key}`;
  return { key, diskPath, publicUrl };
}

export class LocalStorage implements StorageDriver {
  async saveImage(args: {
    bytes: Uint8Array;
    filename: string;
    folder: string;
  }): Promise<StoredFile> {
    return this.saveFile(args);
  }

  async saveFile(args: {
    bytes: Uint8Array;
    filename: string;
    folder: string;
  }): Promise<StoredFile> {
    const { key, diskPath, publicUrl } = createStoredPath(args);
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, args.bytes);
    return { publicUrl, key };
  }
}

