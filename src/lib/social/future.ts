/**
 * Lightweight placeholders for upcoming social features (not wired to UI yet).
 *
 * - Activity feed: emit events when submissions are graded or high scores achieved.
 * - Notifications: store per-user inbox rows; optional push later.
 * - DMs: separate Thread/Message models; validate mutual follow or policy first.
 * - Followers/following lists: paginate `Follow` by followerId or followingId.
 */

export type SocialActivityKind =
  | "submission.created"
  | "submission.graded"
  | "submission.perfect_score"
  | "user.followed";

export type SocialActivityPayload = {
  kind: SocialActivityKind;
  actorUserId: string;
  createdAt: string;
  /** Problem id, submission id, etc. */
  data?: Record<string, string>;
};

export type SocialNotificationChannel = "in_app" | "email" | "push";
