// Keeps the search list across a visit to the chat: before a result is
// opened, how many result pages were loaded and which result was tapped are
// saved, so coming back shows the same list scrolled to that result.

export interface SearchRestore {
  // Result pages that were loaded (the first one included).
  pages: number;
  messageId: number;
}

// More than this many pages is never restored; it keeps a tampered value from
// firing a long chain of requests.
export const MAX_RESTORE_PAGES = 25;

export const searchRestoreKey = (endpoint: string, query: string) =>
  `chat-search:${endpoint}:${query.trim()}`;

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1;

// The stored JSON, or null when it is missing or not a valid value.
export const parseSearchRestore = (
  raw: string | null | undefined,
): SearchRestore | null => {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== "object" || value === null) {
      return null;
    }
    const { pages, messageId } = value as Record<string, unknown>;

    return isPositiveInt(pages) &&
      pages <= MAX_RESTORE_PAGES &&
      isPositiveInt(messageId)
      ? { pages, messageId }
      : null;
  } catch {
    return null;
  }
};

export const serializeSearchRestore = (value: SearchRestore) =>
  JSON.stringify(value);

// Extra pages to load after the first one. Zero when the first page is all
// that was loaded or when there is nothing more to load.
export const extraPagesToLoad = (
  restore: SearchRestore | null,
  loadedPages: number,
  nextCursor: number | null,
) =>
  restore === null || nextCursor === null
    ? 0
    : Math.max(0, restore.pages - loadedPages);

export const saveSearchRestore = (
  endpoint: string,
  query: string,
  value: SearchRestore,
) => {
  try {
    sessionStorage.setItem(
      searchRestoreKey(endpoint, query),
      serializeSearchRestore(value),
    );
  } catch {
    // Private mode or blocked storage: the list just is not restored.
  }
};

export const readSearchRestore = (endpoint: string, query: string) => {
  try {
    return parseSearchRestore(
      sessionStorage.getItem(searchRestoreKey(endpoint, query)),
    );
  } catch {
    return null;
  }
};

export const clearSearchRestore = (endpoint: string, query: string) => {
  try {
    sessionStorage.removeItem(searchRestoreKey(endpoint, query));
  } catch {
    // Nothing to clean up.
  }
};
