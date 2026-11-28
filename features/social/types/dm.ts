// The post a message replies to, computed for the viewer: when they may no
// longer see it (deleted, privacy changed, block) only the id is left.
export type DmReplyPostView =
  | { id: number; available: false }
  | {
      id: number;
      available: true;
      authorName: string;
      authorAvatarUrl: string | null;
      // The full caption; the compact composer bar clamps it with CSS.
      caption: string;
      photo: { url: string; width: number; height: number } | null;
      // Photos of the post; the quote shows the first one and "+N" for the rest.
      photoCount: number;
    };

// The earlier message a message replies to, as a quote: a short text (no
// text for an unsent or photo-only one) and the photo count for its label.
export interface DmReplyToView {
  id: number;
  senderId: number;
  // Trimmed to REPLY_PREVIEW_MAX characters; null without text or when unsent.
  body: string | null;
  photoCount: number;
  deleted: boolean;
}

export interface DmMessageView {
  id: number;
  senderId: number;
  body: string | null;
  photo: { url: string; width: number; height: number } | null;
  // Every photo of the message in display order (`photo` is the first).
  photos?: { url: string; width: number; height: number }[];
  post: DmReplyPostView | null;
  // Absent on optimistic items and old payloads.
  replyTo?: DmReplyToView | null;
  clientId: string;
  createdAt: string;
  // Only the super admin's read-only view lists unsent messages: content is
  // blank and the view shows a placeholder instead.
  deleted?: boolean;
}

export interface DmThreadPage {
  messages: DmMessageView[];
  // Ids (among the latest rows) that were unsent: the client drops them.
  deletedIds: number[];
  hasMore: boolean;
  // The other member's read mark (for "Đã xem").
  otherReadUpTo: number;
}
