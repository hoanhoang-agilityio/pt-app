import "server-only";

import { webizeUrlFields, webizeUrls } from "@/features/chat/utils/api-urls";
import { type ChatPhoto, PHOTO_ALT } from "@/features/chat/utils/photo-rules";
import type { ChatSticker } from "@/features/chat/utils/sticker-rules";
import { tryApi } from "@/services/api/call";

export type UnsentKind = "coach" | "dm" | "group";

// What a super admin gets back for one unsent message: the text, the sticker
// and the photos as the API kept them (#213). The photo URLs are this app's
// proxy routes; the API serves an unsent photo to a super admin only.
export interface RevealedUnsent {
  body: string;
  sticker: ChatSticker | null;
  photos: ChatPhoto[];
}

interface OriginalPhoto {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

interface OriginalMessage {
  body: string | null;
  sticker?: ChatSticker | null;
  photo?: OriginalPhoto | null;
  photos?: OriginalPhoto[];
}

// `photos` is the full list; older payloads carry only the cover in `photo`.
export const toRevealed = (message: OriginalMessage): RevealedUnsent => {
  const list =
    message.photos && message.photos.length > 0
      ? message.photos
      : message.photo
        ? [message.photo]
        : [];

  return {
    body: message.body ?? "",
    sticker: message.sticker ?? null,
    photos: list.map((photo) => ({
      url: photo.url,
      width: photo.width,
      height: photo.height,
      alt: photo.alt ?? PHOTO_ALT,
    })),
  };
};

// The original of an unsent message through the API (super admin only there
// too). Null when it does not exist or is still live (404); anything else
// throws like every other API call.
export const loadUnsentContent = async (
  kind: UnsentKind,
  messageId: number,
  groupId?: number,
): Promise<RevealedUnsent | null> => {
  const outcome =
    kind === "coach"
      ? await tryApi("admin", (api) =>
          api.GET("/v1/chat/messages/{mid}/original", {
            params: { path: { mid: messageId } },
          }),
        )
      : kind === "dm"
        ? await tryApi("admin", (api) =>
            api.GET("/v1/dm/messages/{mid}/original", {
              params: { path: { mid: messageId } },
            }),
          )
        : groupId === undefined
          ? null
          : await tryApi("admin", (api) =>
              api.GET("/v1/chat/groups/{groupId}/messages/{mid}/original", {
                params: { path: { groupId, mid: messageId } },
              }),
            );

  if (outcome === null) {
    return null;
  }
  if (!outcome.ok) {
    if (outcome.error.status === 404) {
      return null;
    }
    throw outcome.error;
  }
  const message =
    kind === "group"
      ? webizeUrlFields(outcome.data.message)
      : webizeUrls(outcome.data.message);

  return toRevealed(message as OriginalMessage);
};
