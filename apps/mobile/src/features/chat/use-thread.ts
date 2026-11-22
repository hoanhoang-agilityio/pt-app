import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  type ChatMsg,
  firstStoredId,
  lastStoredId,
  mergeChanges,
  mergeMessages,
  newestIncomingId,
} from "@/lib/chat-model";
import { qk } from "@/lib/query-keys";
import { threadActionFor, type ThreadTarget } from "@/lib/realtime-events";
import { createSyncScheduler } from "@/lib/sync-scheduler";

import type { ThreadPage, ThreadQuery } from "./api";
import { useRealtime, useRealtimeListener } from "./realtime";

// The state machine of one open conversation, the same for the coach chat,
// groups and DMs: the latest page on open, older pages on demand, and a "sync"
// (new + changed messages since the last fetch) on every realtime event, on
// (re)connect and, while the socket is down, every few seconds.

export const POLL_MS = 5000;
const SYNC_PAGES_MAX = 5;

export type ThreadState<Meta> = {
  messages: ChatMsg[];
  meta: Meta | null;
  hasMore: boolean;
  peerReadUpTo: number;
  status: "loading" | "ready" | "error";
  error: unknown;
  loadingOlder: boolean;
};

export const useThread = <Meta>({
  target,
  load,
  enabled = true,
  onRead,
}: {
  target: ThreadTarget;
  load: (query: ThreadQuery) => Promise<ThreadPage<Meta>>;
  enabled?: boolean;
  // Called with the newest incoming id once it is on screen and the screen is
  // focused. Resolving refreshes the unread badges.
  onRead?: (lastIncomingId: number) => void | Promise<void>;
}) => {
  const [state, setState] = useState<ThreadState<Meta>>({
    messages: [],
    meta: null,
    hasMore: false,
    peerReadUpTo: 0,
    status: "loading",
    error: null,
    loadingOlder: false,
  });
  const loadRef = useRef(load);
  const targetRef = useRef(target);
  const onReadRef = useRef(onRead);
  const messagesRef = useRef<ChatMsg[]>([]);
  const lastChangeAt = useRef(0);
  const readSent = useRef(0);
  const { state: socketState } = useRealtime();
  const focused = useIsFocused();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadRef.current = load;
    targetRef.current = target;
    onReadRef.current = onRead;
  });

  const commit = useCallback(
    (update: (current: ThreadState<Meta>) => ThreadState<Meta>) => {
      setState((current) => {
        const next = update(current);

        messagesRef.current = next.messages;
        return next;
      });
    },
    [],
  );

  const initial = useCallback(async () => {
    try {
      const page = await loadRef.current({});

      lastChangeAt.current = page.lastChangeAt;
      commit(() => ({
        messages: mergeMessages([], page.messages),
        meta: page.meta,
        hasMore: page.hasMore,
        peerReadUpTo: page.peerReadUpTo,
        status: "ready",
        error: null,
        loadingOlder: false,
      }));
    } catch (error) {
      commit((current) => ({ ...current, status: "error", error }));
    }
  }, [commit]);

  const runSync = useCallback(async () => {
    // Nothing loaded yet (empty thread or first load failed): load again.
    if (messagesRef.current.length === 0) {
      await initial();
      return;
    }
    try {
      for (let round = 0; round < SYNC_PAGES_MAX; round += 1) {
        const page = await loadRef.current({
          after: lastStoredId(messagesRef.current) || undefined,
          changedSince: lastChangeAt.current || undefined,
        });

        lastChangeAt.current = Math.max(
          lastChangeAt.current,
          page.lastChangeAt,
        );
        commit((current) => {
          let messages = mergeChanges(
            mergeMessages(current.messages, page.messages),
            page.changes,
          );

          if (page.removedIds.length > 0) {
            const removed = new Set(page.removedIds);

            messages = messages.filter(
              (m) => m.id === null || !removed.has(m.id),
            );
          }
          return {
            ...current,
            messages,
            meta: page.meta ?? current.meta,
            peerReadUpTo: Math.max(current.peerReadUpTo, page.peerReadUpTo),
          };
        });
        if (!page.hasMore || page.messages.length === 0) {
          break;
        }
      }
    } catch {
      // A failed background sync is retried by the next event or poll.
    }
  }, [commit, initial]);

  // A sync requested while one runs is queued, not dropped.
  const runSyncRef = useRef(runSync);
  const scheduler = useRef(createSyncScheduler(() => runSyncRef.current()));
  const sync = scheduler.current;

  useEffect(() => {
    runSyncRef.current = runSync;
  });

  const loadOlder = useCallback(async () => {
    const before = firstStoredId(messagesRef.current);

    if (before === null) {
      return;
    }
    commit((current) => ({ ...current, loadingOlder: true }));
    try {
      const page = await loadRef.current({ before });

      commit((current) => ({
        ...current,
        messages: mergeMessages(current.messages, page.messages),
        hasMore: page.hasMore,
        loadingOlder: false,
      }));
    } catch {
      commit((current) => ({ ...current, loadingOlder: false }));
    }
  }, [commit]);

  useEffect(() => {
    if (enabled) {
      void initial();
    }
  }, [enabled, initial]);

  useRealtimeListener({
    onConnect: () => {
      if (enabled) {
        void sync();
      }
    },
    onEvent: (name, data) => {
      if (
        enabled &&
        threadActionFor(targetRef.current, name, data) === "sync"
      ) {
        void sync();
      }
    },
  });

  // The socket is down: poll, only while the app is in the foreground.
  useEffect(() => {
    if (!enabled || socketState === "connected") {
      return;
    }
    const timer = setInterval(() => {
      if (AppState.currentState === "active") {
        void sync();
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [enabled, socketState, sync]);

  // Report what is on screen as read: on open, when the screen regains focus,
  // when a new incoming message arrives while focused, and after an own reply
  // is stored (the server counts the reply as the reader catching up).
  const newestIncoming = newestIncomingId(state.messages);
  const newestOwn = state.messages.reduce(
    (newest, m) => (m.mine && m.id !== null && m.id > newest ? m.id : newest),
    0,
  );
  const ownSeen = useRef(newestOwn);

  useEffect(() => {
    if (!focused) {
      // Re-report on the next focus.
      readSent.current = 0;
    }
  }, [focused]);

  useEffect(() => {
    if (!focused || state.status !== "ready" || newestIncoming === 0) {
      return;
    }
    const ownReplied = newestOwn > ownSeen.current;

    ownSeen.current = newestOwn;
    if (newestIncoming > readSent.current || ownReplied) {
      readSent.current = newestIncoming;
      void Promise.resolve(onReadRef.current?.(newestIncoming))
        .then(() =>
          Promise.all([
            queryClient.invalidateQueries({ queryKey: qk.unread }),
            queryClient.invalidateQueries({ queryKey: qk.groupUnread }),
            queryClient.invalidateQueries({ queryKey: qk.inbox }),
          ]),
        )
        .catch(() => undefined);
    }
  }, [focused, newestIncoming, newestOwn, state.status, queryClient]);

  // Own unconfirmed bubbles are not stored messages, so they are added and
  // updated directly.
  const putPending = useCallback(
    (message: ChatMsg) =>
      commit((current) => {
        const rest = current.messages.filter(
          (m) => m.clientId !== message.clientId || m.id !== null,
        );

        return { ...current, messages: [...rest, message] };
      }),
    [commit],
  );

  const confirm = useCallback(
    (message: ChatMsg) =>
      commit((current) => ({
        ...current,
        messages: mergeMessages(current.messages, [message]),
      })),
    [commit],
  );

  const patchMessage = useCallback(
    (id: number, patch: (message: ChatMsg) => ChatMsg) =>
      commit((current) => ({
        ...current,
        messages: current.messages.map((m) => (m.id === id ? patch(m) : m)),
      })),
    [commit],
  );

  const removePending = useCallback(
    (clientId: string) =>
      commit((current) => ({
        ...current,
        messages: current.messages.filter(
          (m) => !(m.id === null && m.clientId === clientId),
        ),
      })),
    [commit],
  );

  const markFailed = useCallback(
    (clientId: string) =>
      commit((current) => ({
        ...current,
        messages: current.messages.map((m) =>
          m.id === null && m.clientId === clientId
            ? { ...m, delivery: "failed" as const }
            : m,
        ),
      })),
    [commit],
  );

  return {
    ...state,
    refresh: initial,
    sync,
    loadOlder,
    putPending,
    confirm,
    patchMessage,
    removePending,
    markFailed,
  };
};
