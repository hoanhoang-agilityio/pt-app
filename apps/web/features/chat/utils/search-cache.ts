export interface Loaded {
  ids: number[];
  nextCursor: number | null;
}

// Result ids already fetched, per viewer, endpoint and query. Moving to
// another result remounts the thread (new message window), so the result bar
// starts from here instead of searching again. The key carries the viewer so
// a second account on the same browser never reads the first one's results;
// the search page clears it on mount and on every new search so a stale list
// never outlives the search that produced it.
const cache = new Map<string, Loaded>();

export const searchCacheKey = (
  viewerId: string,
  endpoint: string,
  query: string,
) => `${viewerId}\n${endpoint}\n${query}`;

export const readSearchCache = (key: string): Loaded | null =>
  cache.get(key) ?? null;

export const writeSearchCache = (key: string, value: Loaded) => {
  cache.set(key, value);
};

export const clearSearchCache = () => {
  cache.clear();
};
