/**
 * Future: per-problem visibility for other users' submissions (e.g. only after solve / score threshold).
 * Stub keeps call sites ready without changing behavior yet.
 */
export function canViewOthersSubmission(args: {
  viewerUserId: string | null;
  submissionUserId: string;
  problemId: string;
  visibilityUnlocked: boolean;
}): boolean {
  void args;
  return true;
}
