/** Public shape returned by GET /api/users/search (no email). */
export type UserSearchHit = {
  username: string;
  avatarUrl: string | null;
  displayName: string | null;
  subtitle: string;
  followerCount: number;
  isYou: boolean;
  isFollowing: boolean;
};
