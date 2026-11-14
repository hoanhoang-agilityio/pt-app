"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  contentInput,
  uploadPhotoToUrl,
} from "@/features/chat/hooks/use-chat-adapter";
import type {
  ChatAdapter,
  MessageActionResult,
  SendMessageResult,
} from "@/features/chat/hooks/use-chat-messages";
import type { ThreadViewer } from "@/features/chat/utils/chat-thread-rules";
import {
  adminEditGroupMessageAction,
  adminMarkGroupReadAction,
  adminReactGroupMessageAction,
  adminSendGroupMessageAction,
  adminUnsendGroupMessageAction,
  editGroupMessageAction,
  markGroupReadAction,
  reactGroupMessageAction,
  sendGroupMessageAction,
  unsendGroupMessageAction,
} from "@/features/chat-groups/services/group-actions";
import {
  type GroupApiRole,
  groupRoutes,
} from "@/features/chat-groups/utils/group-adapter-urls";
import {
  type GroupMessageWire,
  isGroupThreadWire,
  parseGroupThread,
  toChatMessage,
} from "@/features/chat-groups/utils/group-thread-map";

interface Options {
  groupId: number;
  role: GroupApiRole;
  viewer: Extract<ThreadViewer, { role: "member" }>;
  // Super admins and PTs; decides who may write under managers-only.
  isManager: boolean;
  // False when only the server knows the person may not write (a trainee with
  // chat off or restricted); admins pass true.
  canWriteBase: boolean;
  // Called with the group's switches every time a fetched payload carries
  // them (managers-only and dissolved can change while the thread is open).
  onGroupState?: (state: { managersOnly: boolean; dissolved: boolean }) => void;
}

type ActionResult =
  | { status: "success"; message: GroupMessageWire }
  | { status: "error"; message: string };

const toResult = (
  result: ActionResult,
  viewerKey: string,
): MessageActionResult & SendMessageResult =>
  result.status === "success"
    ? { status: "success", message: toChatMessage(result.message, viewerKey) }
    : { status: "error", message: result.message };

// The ChatAdapter of a group: the same seam the coach chat uses, wired to the
// group routes and the role's server actions. The shared hook keeps the
// optimistic bubbles, the polling and the mutations; only the URLs, the action
// calls and the payload shape differ.
export const useGroupChatAdapter = ({
  groupId,
  role,
  viewer,
  isManager,
  canWriteBase,
  onGroupState,
}: Options): ChatAdapter => {
  const { key, name } = viewer;
  const groupStateRef = useRef(onGroupState);

  useEffect(() => {
    groupStateRef.current = onGroupState;
  });

  return useMemo<ChatAdapter>(() => {
    const routes = groupRoutes(groupId, role);
    const isAdmin = role === "admin";
    const send = isAdmin ? adminSendGroupMessageAction : sendGroupMessageAction;
    const react = isAdmin
      ? adminReactGroupMessageAction
      : reactGroupMessageAction;
    const edit = isAdmin ? adminEditGroupMessageAction : editGroupMessageAction;
    const unsend = isAdmin
      ? adminUnsendGroupMessageAction
      : unsendGroupMessageAction;
    const markRead = isAdmin ? adminMarkGroupReadAction : markGroupReadAction;

    return {
      messagesUrl: routes.messages,
      editsUrl: routes.edits,
      viewer: { role: "member", key, name },
      parseThread: (raw) => {
        const snapshot = parseGroupThread(raw, {
          viewerKey: key,
          isManager,
          canWriteBase,
        });

        if (snapshot && isGroupThreadWire(raw)) {
          groupStateRef.current?.({
            managersOnly: raw.group.managersOnly,
            dissolved: raw.group.dissolved,
          });
        }
        return snapshot;
      },
      uploadPhoto: (blob) => uploadPhotoToUrl(blob, routes.photos),
      sendMessage: async (content, clientId, replyToMessageId) =>
        toResult(
          (await send({
            groupId,
            ...contentInput(content),
            clientId,
            replyToMessageId,
          })) as ActionResult,
          key,
        ),
      reactMessage: async (messageId, emoji) =>
        toResult(
          (await react({ groupId, messageId, emoji })) as ActionResult,
          key,
        ),
      editMessage: async (messageId, body) =>
        toResult(
          (await edit({ groupId, messageId, body })) as ActionResult,
          key,
        ),
      unsendMessage: async (messageId) =>
        toResult((await unsend({ groupId, messageId })) as ActionResult, key),
      markRead: (lastReadMessageId) => markRead({ groupId, lastReadMessageId }),
    };
  }, [groupId, role, key, name, isManager, canWriteBase]);
};
