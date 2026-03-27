export type StoredFile = {
  publicUrl: string;
  key: string;
};

export type StorageDriver = {
  saveImage(args: { bytes: Uint8Array; filename: string; folder: string }): Promise<StoredFile>;
};

