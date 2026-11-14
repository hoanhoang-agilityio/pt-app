import { ADMIN_MESSAGES_SEGMENT, ROUTES } from "@/constants/routes";
import { isSearchableQuery } from "@/features/chat/utils/search-rules";

// Where the chat, its info page and the info sub-pages live for each side
// (KAN-160). The trainee has one fixed set; an admin has one per trainee.
export interface ChatPaths {
  chat: string;
  info: string;
  photos: string;
  search: string;
}

const pathsUnder = (base: string): ChatPaths => ({
  chat: base,
  info: `${base}/info`,
  photos: `${base}/photos`,
  search: `${base}/search`,
});

export const chatPaths = (role: "user" | "admin", userId: number): ChatPaths =>
  role === "admin"
    ? pathsUnder(`${ROUTES.ADMIN_USERS}/${userId}/${ADMIN_MESSAGES_SEGMENT}`)
    : pathsUnder(ROUTES.MESSAGES_COACH);

// The chat opened at one message: it is loaded, scrolled to and highlighted.
// With `query` (a search result) the chat also shows the result bar.
export const jumpHref = (
  chatPath: string,
  messageId: number,
  query?: string,
) =>
  query === undefined
    ? `${chatPath}?m=${messageId}`
    : `${chatPath}?${new URLSearchParams({ m: String(messageId), q: query })}`;

// The search page with the query kept in its URL.
export const searchHref = (searchPath: string, query: string) =>
  `${searchPath}?${new URLSearchParams({ q: query })}`;

// `?q=` of the chat or search page: the trimmed query when it is a searchable
// one (two to SEARCH_MAX_LENGTH characters), otherwise null.
export const parseSearchQuery = (value: string | string[] | undefined) => {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim();

  return raw !== undefined && isSearchableQuery(raw) ? raw : null;
};

// `?m=` of the chat page; anything that is not a plain positive id is ignored.
export const parseJumpId = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw !== undefined && /^[1-9]\d{0,14}$/.test(raw) ? Number(raw) : null;
};

// The chat opened with a post quoted above the composer ("Trả lời qua tin
// nhắn" on a post card). `userId` is the trainee: the viewer for the user side.
export const replyPostHref = (
  role: "user" | "admin",
  userId: number,
  postId: number,
) => `${chatPaths(role, userId).chat}?replyPost=${postId}`;
