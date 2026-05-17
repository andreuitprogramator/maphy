import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type CreateNotificationInput = {
  userId: string;
  actorUserId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  targetUrl?: string | null;
  relatedProblemId?: string | null;
  relatedSubmissionId?: string | null;
  relatedConversationId?: string | null;
  relatedCommentId?: string | null;
  eventKey?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  if (!input.userId) return null;
  if (input.actorUserId && input.actorUserId === input.userId) return null;

  try {
    return await prisma.notification.create({
      data: {
        userId: input.userId,
        actorUserId: input.actorUserId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        targetUrl: input.targetUrl ?? null,
        relatedProblemId: input.relatedProblemId ?? null,
        relatedSubmissionId: input.relatedSubmissionId ?? null,
        relatedConversationId: input.relatedConversationId ?? null,
        relatedCommentId: input.relatedCommentId ?? null,
        eventKey: input.eventKey ?? null,
      },
      select: { id: true },
    });
  } catch (err) {
    if (input.eventKey && err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return null;
    }
    throw err;
  }
}

export async function createManyNotifications(inputs: CreateNotificationInput[]) {
  const rows = inputs.filter((x) => x.userId && (!x.actorUserId || x.actorUserId !== x.userId));
  if (rows.length === 0) return { count: 0 };

  return prisma.notification.createMany({
    data: rows.map((x) => ({
      userId: x.userId,
      actorUserId: x.actorUserId ?? null,
      type: x.type,
      title: x.title,
      body: x.body,
      targetUrl: x.targetUrl ?? null,
      relatedProblemId: x.relatedProblemId ?? null,
      relatedSubmissionId: x.relatedSubmissionId ?? null,
      relatedConversationId: x.relatedConversationId ?? null,
      relatedCommentId: x.relatedCommentId ?? null,
      eventKey: x.eventKey ?? null,
    })),
    skipDuplicates: true,
  });
}

export async function notifyUserFollowed(args: {
  followerId: string;
  followerUsername: string;
  targetUserId: string;
}) {
  return createNotification({
    userId: args.targetUserId,
    actorUserId: args.followerId,
    type: NotificationType.FOLLOWED_YOU,
    title: "New follower",
    body: `@${args.followerUsername} followed you.`,
    targetUrl: `/u/${args.followerUsername}`,
    eventKey: `follow:${args.followerId}:${args.targetUserId}`,
  });
}

export async function notifyFollowersOfSubmission(args: {
  submissionId: string;
  submitterId: string;
  submitterUsername: string;
  problemId: string;
  problemTitle: string;
}) {
  const followers = await prisma.follow.findMany({
    where: { followingId: args.submitterId },
    select: { followerId: true },
  });

  return createManyNotifications(
    followers.map((f) => ({
      userId: f.followerId,
      actorUserId: args.submitterId,
      type: NotificationType.FOLLOWING_USER_SUBMITTED,
      title: "New submission",
      body: `@${args.submitterUsername} submitted a solution to ${args.problemTitle}.`,
      targetUrl: `/problems/${args.problemId}`,
      relatedProblemId: args.problemId,
      relatedSubmissionId: args.submissionId,
      eventKey: `submission:${args.submissionId}:to:${f.followerId}`,
    })),
  );
}

export async function notifyNewDirectMessage(args: {
  recipientUserId: string;
  senderUserId: string;
  senderUsername: string;
  conversationId: string;
  messageId: string;
}) {
  return createNotification({
    userId: args.recipientUserId,
    actorUserId: args.senderUserId,
    type: NotificationType.NEW_DIRECT_MESSAGE,
    title: "New message",
    body: `New message from @${args.senderUsername}.`,
    targetUrl: `/messages?c=${args.conversationId}`,
    relatedConversationId: args.conversationId,
    eventKey: `dm:${args.messageId}:to:${args.recipientUserId}`,
  });
}

export async function notifyUsersNewProblemPublished(args: {
  problemId: string;
  problemTitle: string;
  publisherUserId: string;
  publisherUsername: string;
}) {
  const users = await prisma.user.findMany({ select: { id: true } });
  return createManyNotifications(
    users.map((u) => ({
      userId: u.id,
      actorUserId: args.publisherUserId,
      type: NotificationType.NEW_PROBLEM_PUBLISHED,
      title: "New problem published",
      body: `@${args.publisherUsername} published: ${args.problemTitle}.`,
      targetUrl: `/problems/${args.problemId}`,
      relatedProblemId: args.problemId,
      eventKey: `problem:${args.problemId}:to:${u.id}`,
    })),
  );
}
