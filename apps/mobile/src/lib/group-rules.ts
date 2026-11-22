import { GROUP_MEMBER_CAP } from "@pt/contracts";

// Small pure rules behind the group screens (ported from the web's
// features/chat-groups/utils/group-display.ts and chat/utils/inbox-search.ts).

// Case- and diacritics-insensitive text; "đ" has no decomposed form.
export const normalizeSearchText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

// True when any of the names contains the query; an empty query matches all.
export const matchesSearch = (query: string, ...names: readonly string[]) => {
  const needle = normalizeSearchText(query);

  return needle === "" || names.some((name) => normalizeSearchText(name).includes(needle));
};

export type PickerCandidate = { key: string; name: string };

export const filterCandidates = <T extends PickerCandidate>(
  candidates: readonly T[],
  query: string,
): T[] => candidates.filter((item) => matchesSearch(query, item.name));

// Adds or removes one key. Adding beyond `cap` is refused (the set is returned
// unchanged), so the picker never offers more than the group can hold.
export const toggleSelection = (
  selected: ReadonlySet<string>,
  key: string,
  cap: number = GROUP_MEMBER_CAP,
): ReadonlySet<string> => {
  const next = new Set(selected);

  if (next.has(key)) {
    next.delete(key);
    return next;
  }
  if (next.size >= cap) {
    return selected;
  }
  next.add(key);
  return next;
};

// The ids the create and add calls take, split by kind in a stable order.
export const selectionToIds = (selected: ReadonlySet<string>) => {
  const userIds: number[] = [];
  const ptIds: number[] = [];

  for (const key of selected) {
    const [kind, raw] = key.split(":");
    const id = Number(raw);

    if (!Number.isInteger(id) || id <= 0) {
      continue;
    }
    if (kind === "user") {
      userIds.push(id);
    } else if (kind === "admin") {
      ptIds.push(id);
    }
  }
  return { userIds: userIds.sort((a, b) => a - b), ptIds: ptIds.sort((a, b) => a - b) };
};

// Places left for explicit members (super admins are implicit and not counted).
export const freePlaces = (members: readonly { role: string }[]) =>
  Math.max(0, GROUP_MEMBER_CAP - members.filter((m) => m.role !== "super_admin").length);

// How many of an add/create result's entries went in, and how many did not.
export const addOutcomeCounts = (results: readonly { outcome: string }[]) => {
  const added = results.filter((item) => item.outcome === "added").length;

  return { added, skipped: results.length - added };
};
