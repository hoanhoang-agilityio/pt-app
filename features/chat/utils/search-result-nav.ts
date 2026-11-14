// Moving between search results from inside the chat. Results are ordered
// newest first, so the "older" neighbour is the next index.

export interface ResultNav {
  // 1-based position among the loaded results; null when the open message is
  // not one of them.
  position: number | null;
  total: number;
  olderId: number | null;
  newerId: number | null;
  // The open message is the last loaded result and more pages exist.
  needsOlderPage: boolean;
}

export const resultNav = (
  ids: readonly number[],
  currentId: number | null,
  hasMoreOlder: boolean,
): ResultNav => {
  const index = currentId === null ? -1 : ids.indexOf(currentId);

  if (index === -1) {
    return {
      position: null,
      total: ids.length,
      olderId: null,
      newerId: null,
      needsOlderPage: false,
    };
  }
  const isLast = index === ids.length - 1;

  return {
    position: index + 1,
    total: ids.length,
    olderId: isLast ? null : ids[index + 1],
    newerId: index === 0 ? null : ids[index - 1],
    needsOlderPage: isLast && hasMoreOlder,
  };
};

// Appends a page of ids, dropping ones already known, keeping the order.
export const appendIds = (
  known: readonly number[],
  page: readonly number[],
) => [...known, ...page.filter((id) => !known.includes(id))];
