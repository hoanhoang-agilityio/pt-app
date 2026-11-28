"use client";

import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { ChatHeader } from "@/features/chat/components/ChatHeader";
import {
  ChatThread,
  type ChatThreadProps,
} from "@/features/chat/components/ChatThread";
import { MuteChip } from "@/features/chat/components/MuteChip";
import { NeutralColorsSwitch } from "@/features/chat/components/NeutralColorsSwitch";
import { chatPaths } from "@/features/chat/utils/chat-links";
import { displayNameFor } from "@/features/chat/utils/display-name";
import type { MuteState } from "@/features/chat/utils/mute-rules";
import { bubbleKeyFor } from "@/features/chat-bubbles/utils/bubble-links";

interface AdminChatThreadProps extends Pick<
  ChatThreadProps,
  | "initial"
  | "userId"
  | "conversationId"
  | "jumpToId"
  | "jumpMissed"
  | "searchContext"
  | "viewer"
  | "emptyText"
  | "ariaLabel"
  | "avatars"
  | "replyPost"
  | "isEmbed"
> {
  // The trainee's real name; the admin's private nickname for them wins in the title.
  userName: string;
  // Server-rendered rows under the header (section tabs, lock switch).
  // Not rendered inside the bubble panel.
  below?: ReactNode;
  // This admin's mute of the trainee, for the "Đã tắt thông báo" chip.
  muteState: MuteState;
}

// The admin conversation screen. A client component because the title follows
// the nickname and the status follows the live presence (a function prop
// cannot cross from a server page).
export const AdminChatThread = ({
  userName,
  below,
  muteState,
  ...thread
}: AdminChatThreadProps) => {
  return (
    <ChatThread
      {...thread}
      infoHref={chatPaths("admin", thread.userId).info}
      header={(
        _latestPeerName,
        presence,
        { profile, infoHref, peerAvatar },
      ) => {
        const name = displayNameFor(profile.nicknames, "user", userName);

        return (
          <>
            <ChatHeader
              name={name}
              backHref={ROUTES.ADMIN_MESSAGES}
              presence={presence}
              avatarSrc={peerAvatar}
              infoHref={infoHref}
              actions={<NeutralColorsSwitch />}
              bubble={{
                role: "admin",
                key: bubbleKeyFor("admin", thread.userId),
              }}
            />
            <MuteChip userId={thread.userId} name={name} initial={muteState} />
            {below}
          </>
        );
      }}
    />
  );
};
