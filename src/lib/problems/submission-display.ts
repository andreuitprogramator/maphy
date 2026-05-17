/** Minimum graded AI score on a problem to view other users' submission images (not necessarily perfect). */
export const PEER_SOLUTION_IMAGE_UNLOCK_MIN_SCORE = 90;

/** Serializable shape for client components (dates as ISO strings). */
export type ProblemSubmissionSerializable = {
  id: string;
  status: "PENDING" | "BLURRY_REJECTED" | "GRADED" | "FAILED";
  aiScore: number | null;
  aiFeedback: string | null;
  aiBreakdown: unknown;
  imageQualityReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  imageUrl: string;
  user: { username: string; avatarUrl: string | null };
};

export type PublicSubmissionSerializable = {
  id: string;
  status: "PENDING" | "BLURRY_REJECTED" | "GRADED" | "FAILED";
  aiScore: number | null;
  aiFeedback: string | null;
  aiBreakdown: unknown;
  imageQualityReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  imageUrl: string | null;
  canViewImage: boolean;
  user: { username: string; avatarUrl: string | null };
};

export function serializeSubmissionsForClient<
  T extends {
    id: string;
    status: ProblemSubmissionSerializable["status"];
    aiScore: number | null;
    aiFeedback: string | null;
    aiBreakdown: unknown;
    imageQualityReason: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    imageUrl: string;
    user: { username: string; avatarUrl: string | null };
  },
>(rows: T[]): ProblemSubmissionSerializable[] {
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    aiScore: r.aiScore,
    aiFeedback: r.aiFeedback,
    aiBreakdown: r.aiBreakdown,
    imageQualityReason: r.imageQualityReason,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    imageUrl: r.imageUrl,
    user: r.user,
  }));
}

export type ProfileSubmissionSerializable = ProblemSubmissionSerializable & {
  problem: { id: string; title: string };
};

export function serializeProfileSubmissionsForClient<
  T extends {
    id: string;
    status: ProblemSubmissionSerializable["status"];
    aiScore: number | null;
    aiFeedback: string | null;
    aiBreakdown: unknown;
    imageQualityReason: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    imageUrl: string;
    problem: { id: string; title: string };
  },
>(rows: T[], profileUsername = ""): ProfileSubmissionSerializable[] {
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    aiScore: r.aiScore,
    aiFeedback: r.aiFeedback,
    aiBreakdown: r.aiBreakdown,
    imageQualityReason: r.imageQualityReason,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    imageUrl: r.imageUrl,
    user: { username: profileUsername, avatarUrl: null },
    problem: r.problem,
  }));
}

export function serializePublicSubmissionsForClient<
  T extends {
    id: string;
    status: PublicSubmissionSerializable["status"];
    aiScore: number | null;
    aiFeedback: string | null;
    aiBreakdown: unknown;
    imageQualityReason: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
    imageUrl: string | null;
    canViewImage: boolean;
    user: { username: string; avatarUrl: string | null };
  },
>(rows: T[]): PublicSubmissionSerializable[] {
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    aiScore: r.aiScore,
    aiFeedback: r.aiFeedback,
    aiBreakdown: r.aiBreakdown,
    imageQualityReason: r.imageQualityReason,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    imageUrl: r.imageUrl,
    canViewImage: r.canViewImage,
    user: r.user,
  }));
}
