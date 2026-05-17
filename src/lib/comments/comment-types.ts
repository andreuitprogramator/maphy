export type CommentAuthorRole = "STUDENT" | "TEACHER" | "OTHER";

export type ProblemCommentTreeNode = {
  id: string;
  body: string;
  imageUrl: string | null;
  containsSpoiler: boolean;
  createdAt: string;
  editedAt: string | null;
  parentCommentId: string | null;
  replyTo: { id: string; username: string } | null;
  user: { username: string; avatarUrl: string | null; roleLabel: CommentAuthorRole };
  badges: { isTeacher: boolean; isAuthor: boolean; solved100: boolean };
  likes: number;
  dislikes: number;
  myReaction: "LIKE" | "DISLIKE" | null;
  directReplyCount: number;
  replies: ProblemCommentTreeNode[];
};
