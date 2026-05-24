import { LocalStorage } from "@/lib/storage/local";
import { VercelBlobStorage } from "@/lib/storage/vercel-blob";

export const storage = process.env.BLOB_READ_WRITE_TOKEN
  ? new VercelBlobStorage()
  : new LocalStorage();

