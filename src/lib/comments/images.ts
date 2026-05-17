export const COMMENT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isAllowedCommentImageMime(mime: string): boolean {
  return ALLOWED.has(mime);
}
