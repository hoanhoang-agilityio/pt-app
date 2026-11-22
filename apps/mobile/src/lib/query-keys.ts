// TanStack Query keys, in one place so realtime events and mutations can
// invalidate the same lists the screens read.

export const qk = {
  me: ["me"] as const,
  sessions: ["sessions"] as const,
  socialMe: ["social", "me"] as const,
  feed: ["social", "feed"] as const,
  post: (id: number) => ["social", "post", id] as const,
  comments: (id: number) => ["social", "comments", id] as const,
  reactors: (id: number) => ["social", "reactors", id] as const,
  profile: (key: string) => ["social", "profile", key] as const,
  profilePosts: (key: string) => ["social", "profile-posts", key] as const,
  notifications: ["social", "notifications"] as const,
  inbox: ["chat", "inbox"] as const,
  unread: ["chat", "unread"] as const,
  bubbles: ["chat", "bubbles"] as const,
  groups: ["chat", "groups"] as const,
  groupUnread: ["chat", "group-unread"] as const,
  dmInbox: ["chat", "dm-inbox"] as const,
  giphy: (q: string) => ["chat", "giphy", q] as const,
  customStickers: ["chat", "custom-stickers"] as const,
};
