"use client";

import { useCallback, useSyncExternalStore } from "react";

import { withQuery } from "@/features/chat/utils/unread-payload";
import { startVisibleInterval } from "@/utils/visible-interval";

// Dispatched on window by live inbox events so badges refetch right away.
export const UNREAD_REFRESH_EVENT = "chat:unread-refresh";

// One poller per URL for the whole tab, shared by the tab-bar badge, the admin
// inbox badge and the chat bubbles. Ref-counted: it starts with the first
// subscriber and stops with the last. Cadence rules as before: a timer that
// only ticks while the tab is visible (one fetch when it comes back), plus a
// refetch on focus and on UNREAD_REFRESH_EVENT. A subscriber may add an extra
// query (the thread's `peer=1`): the poll then asks for it, so badge, own
// presence and the peer's presence stay one request per tick.
interface Entry {
  data: unknown;
  subscribers: Map<
    object,
    { listener: () => void; pollMs: number; query: string }
  >;
  inFlight: boolean;
  // A subscriber changed what the poll asks for while a fetch was running.
  refetch: boolean;
  lastQuery: string;
  stopTimer: (() => void) | null;
  timerMs: number;
  detach: () => void;
}

const BEAT_QUERY = "beat=1";

const entries = new Map<string, Entry>();

const emit = (entry: Entry) => {
  entry.subscribers.forEach(({ listener }) => listener());
};

// The extra query to send: the first one any subscriber asks for.
const wantedQuery = (entry: Entry) =>
  Array.from(entry.subscribers.values(), (item) => item.query).find(
    (query) => query !== "",
  ) ?? "";

const refresh = async (url: string, entry: Entry) => {
  if (entry.inFlight || document.visibilityState === "hidden") {
    return;
  }
  entry.inFlight = true;
  entry.lastQuery = wantedQuery(entry);
  try {
    // `beat=1`: this poll runs in an open page, so it records presence.
    const response = await fetch(
      withQuery(withQuery(url, BEAT_QUERY), entry.lastQuery),
      {
        cache: "no-store",
      },
    );

    if (response.ok && entries.get(url) === entry) {
      entry.data = await response.json();
      emit(entry);
    }
  } catch {
    // Offline or server hiccup: keep the last payload.
  } finally {
    entry.inFlight = false;
    if (entry.refetch) {
      entry.refetch = false;
      void refresh(url, entry);
    }
  }
};

// Fetches again at once when the wanted query differs from the last one sent
// (a thread opened or closed); a running fetch is followed by another.
const refreshIfQueryChanged = (url: string, entry: Entry) => {
  if (wantedQuery(entry) === entry.lastQuery) {
    return;
  }
  if (entry.inFlight) {
    entry.refetch = true;
    return;
  }
  void refresh(url, entry);
};

// The fastest cadence any subscriber asks for.
const restartTimer = (url: string, entry: Entry) => {
  const wanted = Math.min(
    ...Array.from(entry.subscribers.values(), (item) => item.pollMs),
  );

  if (entry.stopTimer && entry.timerMs === wanted) {
    return;
  }
  entry.stopTimer?.();
  entry.timerMs = wanted;
  entry.stopTimer = startVisibleInterval(
    () => void refresh(url, entry),
    wanted,
  );
};

const createEntry = (url: string): Entry => {
  const onNudge = () => {
    const entry = entries.get(url);

    if (entry) {
      void refresh(url, entry);
    }
  };
  const entry: Entry = {
    data: null,
    subscribers: new Map(),
    inFlight: false,
    refetch: false,
    lastQuery: "",
    stopTimer: null,
    timerMs: 0,
    detach: () => {
      window.removeEventListener("focus", onNudge);
      window.removeEventListener(UNREAD_REFRESH_EVENT, onNudge);
    },
  };

  window.addEventListener("focus", onNudge);
  window.addEventListener(UNREAD_REFRESH_EVENT, onNudge);
  return entry;
};

export const subscribeUnread = (
  url: string,
  pollMs: number,
  listener: () => void,
  query = "",
) => {
  const token = {};
  let entry = entries.get(url);
  const isFirst = !entry;

  if (!entry) {
    entry = createEntry(url);
    entries.set(url, entry);
  }
  entry.subscribers.set(token, { listener, pollMs, query });
  restartTimer(url, entry);
  if (isFirst) {
    void refresh(url, entry);
  } else {
    refreshIfQueryChanged(url, entry);
  }
  const current = entry;

  return () => {
    current.subscribers.delete(token);
    if (current.subscribers.size === 0) {
      current.stopTimer?.();
      current.detach();
      entries.delete(url);
      return;
    }
    restartTimer(url, current);
  };
};

export const getUnreadSnapshot = (url: string) =>
  entries.get(url)?.data ?? null;

// Latest raw payload of `url` (null until the first poll lands), or null and
// no polling at all while `enabled` is false.
export const useUnreadPayload = (
  url: string,
  enabled: boolean,
  pollMs: number,
  query = "",
): unknown => {
  const subscribe = useCallback(
    (listener: () => void) =>
      enabled ? subscribeUnread(url, pollMs, listener, query) : () => undefined,
    [url, enabled, pollMs, query],
  );

  return useSyncExternalStore(
    subscribe,
    () => (enabled ? getUnreadSnapshot(url) : null),
    () => null,
  );
};
