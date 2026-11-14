import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  chatConversations,
  chatGroupMessages,
  chatGroups,
  chatMessages,
  socialComments,
  socialPosts,
  socialReports,
  users,
} from "@/db/schema";
import { chatPaths, jumpHref } from "@/features/chat/utils/chat-links";
import { loadActorIdentities } from "@/features/chat-groups/services/group-names";
import { loadAccounts } from "@/features/social/services/account-lookup";
import type { ReportView } from "@/features/social/types/social";
import { adminPostPath } from "@/features/social/utils/engagement-rules";
import { adminProfilePath } from "@/features/social/utils/post-rules";
import { getFormatTranslator } from "@/i18n/format-translator";
import { DEFAULT_LOCALE, type Locale } from "@/utils/locale";
import { getAdminGroupPath } from "@/utils/routes";

const PREVIEW_LENGTH = 140;

const snippet = (text: string | null, fallback: string) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();

  if (flat === "") {
    return fallback;
  }
  return flat.length > PREVIEW_LENGTH
    ? `${flat.slice(0, PREVIEW_LENGTH)}…`
    : flat;
};

export const countOpenReports = async () => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(socialReports)
    .where(eq(socialReports.status, "open"));

  return Number(row?.count ?? 0);
};

// Open reports, oldest first, each with a preview of what was reported.
export const listOpenReports = async (
  locale: Locale = DEFAULT_LOCALE,
): Promise<ReportView[]> => {
  const t = getFormatTranslator(locale);
  const reports = await db
    .select()
    .from(socialReports)
    .where(eq(socialReports.status, "open"))
    .orderBy(asc(socialReports.createdAt), asc(socialReports.id));
  const postIds = reports
    .filter((report) => report.targetKind === "post")
    .map((report) => report.targetId);
  const commentIds = reports
    .filter((report) => report.targetKind === "comment")
    .map((report) => report.targetId);
  const userIds = reports
    .filter((report) => report.targetKind === "user")
    .map((report) => report.targetId);
  const messageIds = reports
    .filter((report) => report.targetKind === "message")
    .map((report) => report.targetId);
  const groupMessageIds = reports
    .filter((report) => report.targetKind === "group_message")
    .map((report) => report.targetId);
  const [posts, comments, targetUsers, messageRows, groupRows] =
    await Promise.all([
      postIds.length
        ? db.select().from(socialPosts).where(inArray(socialPosts.id, postIds))
        : [],
      commentIds.length
        ? db
            .select()
            .from(socialComments)
            .where(inArray(socialComments.id, commentIds))
        : [],
      userIds.length
        ? db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, userIds))
        : [],
      messageIds.length
        ? db
            .select({
              id: chatMessages.id,
              body: chatMessages.body,
              stickerRef: chatMessages.stickerRef,
              photoId: chatMessages.photoId,
              senderRole: chatMessages.senderRole,
              deletedAt: chatMessages.deletedAt,
              hiddenByAdminId: chatMessages.hiddenByAdminId,
              senderAdminName: admins.username,
              traineeId: chatConversations.userId,
              traineeName: users.name,
            })
            .from(chatMessages)
            .innerJoin(
              chatConversations,
              eq(chatConversations.id, chatMessages.conversationId),
            )
            .innerJoin(users, eq(users.id, chatConversations.userId))
            .leftJoin(admins, eq(admins.id, chatMessages.senderAdminId))
            .where(inArray(chatMessages.id, messageIds))
        : [],
      groupMessageIds.length
        ? db
            .select({
              id: chatGroupMessages.id,
              groupId: chatGroupMessages.groupId,
              groupName: chatGroups.name,
              senderKey: chatGroupMessages.senderKey,
              body: chatGroupMessages.body,
              stickerRef: chatGroupMessages.stickerRef,
              photoId: chatGroupMessages.photoId,
              deletedAt: chatGroupMessages.deletedAt,
              hiddenAt: chatGroupMessages.hiddenAt,
            })
            .from(chatGroupMessages)
            .innerJoin(chatGroups, eq(chatGroups.id, chatGroupMessages.groupId))
            .where(inArray(chatGroupMessages.id, groupMessageIds))
        : [],
    ]);
  const groupSenders = await loadActorIdentities(
    groupRows.flatMap((row) => (row.senderKey ? [row.senderKey] : [])),
  );
  const accounts = await loadAccounts([
    ...reports.map((report) => report.reporterKey),
    ...posts.map((post) => `${post.authorKind}:${post.authorId}`),
    ...comments.map((comment) => comment.authorKey),
  ]);
  const nameOf = (key: string) =>
    accounts.get(key)?.name ?? t("fallback.deletedAccount");
  const postById = new Map(posts.map((post) => [post.id, post]));
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));
  const userById = new Map(targetUsers.map((user) => [user.id, user]));
  const messageById = new Map(messageRows.map((row) => [row.id, row]));
  const groupMessageById = new Map(groupRows.map((row) => [row.id, row]));

  return reports.map((report): ReportView => {
    const base = {
      id: report.id,
      targetKind: report.targetKind,
      targetId: report.targetId,
      reporterName: nameOf(report.reporterKey),
      reason: report.reason,
      reasonCode: report.reasonCode,
      message: null,
      group: null,
      createdAt: report.createdAt.getTime(),
    };

    if (report.targetKind === "message") {
      const message = messageById.get(report.targetId);

      // Unsent or already hidden: nothing left to look at.
      if (
        !message ||
        message.deletedAt !== null ||
        message.hiddenByAdminId !== null
      ) {
        return { ...base, preview: null, targetName: null, href: null };
      }
      const kind = message.stickerRef
        ? "sticker"
        : message.photoId !== null && message.body.trim() === ""
          ? "photo"
          : "text";
      const senderName =
        message.senderRole === "user"
          ? message.traineeName
          : (message.senderAdminName ?? "PT");

      return {
        ...base,
        message: {
          senderRole: message.senderRole,
          senderName,
          traineeId: message.traineeId,
          traineeName: message.traineeName,
          kind,
        },
        preview:
          kind === "sticker"
            ? t("fallback.stickerMessage")
            : kind === "photo"
              ? t("fallback.photoMessage")
              : snippet(message.body, ""),
        targetName: senderName,
        href: jumpHref(chatPaths("admin", message.traineeId).chat, message.id),
      };
    }

    if (report.targetKind === "group_message") {
      const message = groupMessageById.get(report.targetId);

      // Unsent or already hidden: nothing left to look at.
      if (!message || message.deletedAt !== null || message.hiddenAt !== null) {
        return { ...base, preview: null, targetName: null, href: null };
      }
      const kind = message.stickerRef
        ? "sticker"
        : message.photoId !== null && message.body.trim() === ""
          ? "photo"
          : "text";
      const sender = message.senderKey
        ? groupSenders.get(message.senderKey)
        : undefined;
      const senderName = sender?.name ?? t("fallback.deletedAccount");
      // A trainee sender can be restricted from the queue; PTs and super
      // admins cannot.
      const senderUserId =
        sender?.role === "trainee"
          ? Number(message.senderKey?.split(":")[1])
          : 0;

      return {
        ...base,
        message: {
          senderRole: sender?.role === "trainee" ? "user" : "admin",
          senderName,
          traineeId: senderUserId,
          traineeName: sender?.role === "trainee" ? senderName : "",
          kind,
        },
        group: { id: message.groupId, name: message.groupName },
        preview:
          kind === "sticker"
            ? t("fallback.stickerMessage")
            : kind === "photo"
              ? t("fallback.photoMessage")
              : snippet(message.body, ""),
        targetName: senderName,
        href: getAdminGroupPath(message.groupId),
      };
    }

    if (report.targetKind === "post") {
      const post = postById.get(report.targetId);

      return post && post.deletedAt === null
        ? {
            ...base,
            preview: snippet(post.caption, t("fallback.postImageOnly")),
            targetName: nameOf(`${post.authorKind}:${post.authorId}`),
            href: adminPostPath(post.id),
          }
        : { ...base, preview: null, targetName: null, href: null };
    }
    if (report.targetKind === "comment") {
      const comment = commentById.get(report.targetId);

      if (!comment || comment.deletedAt !== null) {
        return { ...base, preview: null, targetName: null, href: null };
      }
      return {
        ...base,
        preview: snippet(comment.body, ""),
        targetName: nameOf(comment.authorKey),
        href: adminPostPath(comment.postId),
      };
    }
    const target = userById.get(report.targetId);

    return target
      ? {
          ...base,
          preview: null,
          targetName: target.name,
          href: adminProfilePath("user", target.id),
        }
      : { ...base, preview: null, targetName: null, href: null };
  });
};
