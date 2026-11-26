"use client";

import type { RealtimeChannel } from "ably";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHAT_EVENTS,
  conversationChannel,
  groupChannel,
  typingChannel,
  userChannel,
} from "@/features/chat/utils/ably-capabilities";
import {
  pollIntervalFor,
  type RealtimeState,
  realtimeStateFor,
} from "@/features/chat/utils/chat-thread-rules";
import {
  isTypingFromPeer,
  shouldSendTyping,
  TYPING_EXPIRY_MS,
} from "@/features/chat/utils/typing-rules";
import { isUserIdle, onUserActive } from "@/utils/user-idle";

const USER_TOKEN_URL = "/api/chat/ably-token";
const ADMIN_TOKEN_URL = "/api/chat/ably-token?as=admin";

interface UseChatTransportOptions {
  role: "user" | "admin";
  userId: number;
  conversationId: number | null;
  // A group chat: its own token (`?group=<id>`) and channel, no typing, no
  // user channel. The coach chat leaves it out.
  groupId?: number | null;
  chatEnabled: boolean;
  // Asks the owner to fetch what is new. Called on every realtime event, on
  // every poll tick, on (re)connect and when the tab becomes visible.
  onSync: () => void;
}

// The ChatTransport seam: realtime via Ably when the server hands out a token,
// plain polling otherwise. Ably events carry no sender name, so any event just
// triggers a fetch (which also fills gaps). Turso stays the source of truth.
export const useChatTransport = ({
  role,
  userId,
  conversationId,
  groupId = null,
  chatEnabled,
  onSync,
}: UseChatTransportOptions) => {
  const [state, setState] = useState<RealtimeState>("connecting");
  const [isHidden, setIsHidden] = useState(false);
  const [isPeerTypingNow, setIsPeerTypingNow] = useState(false);
  const syncRef = useRef(onSync);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAt = useRef<number | null>(null);
  // Mirrors the connection for sendTyping without re-creating it.
  const connectedRef = useRef(false);
  // The typing channel of the live client; null without a connection.
  const typingChannelRef = useRef<RealtimeChannel | null>(null);

  const clearPeerTyping = useCallback(() => {
    if (typingTimer.current !== null) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    setIsPeerTypingNow(false);
  }, []);

  useEffect(() => {
    syncRef.current = onSync;
  });

  // A locked trainee gets no token (403) and polls only. An admin is never
  // refused one: chat-status events tell them when the chat is unlocked.
  // A group token is minted after the membership check; a trainee whose chat
  // is off still reads, so `chatEnabled` plays no part there.
  const canConnect =
    groupId !== null ||
    (conversationId !== null && (role === "admin" || chatEnabled));

  useEffect(() => {
    if (!canConnect || (conversationId === null && groupId === null)) {
      return;
    }
    const tokenUrl =
      groupId !== null
        ? `/api/chat/ably-token?group=${groupId}${role === "admin" ? "&as=admin" : ""}`
        : role === "admin"
          ? ADMIN_TOKEN_URL
          : USER_TOKEN_URL;
    let cancelled = false;
    let close: (() => void) | undefined;

    const connect = async () => {
      setState("connecting");
      try {
        const Ably = await import("ably");

        if (cancelled) {
          return;
        }
        const client = new Ably.Realtime({
          autoConnect: true,
          authCallback: (_params, callback) => {
            fetch(tokenUrl, { cache: "no-store" })
              .then(async (response) => {
                if (response.status === 200) {
                  callback(null, await response.json());
                  return;
                }
                // 204 = no key configured, 403 = locked, 404 = not a member (groups):
                // stay on polling.
                if (
                  response.status === 204 ||
                  response.status === 403 ||
                  response.status === 404
                ) {
                  if (!cancelled) {
                    setState("unavailable");
                  }
                  client.close();
                }
                callback(`token request failed (${response.status})`, null);
              })
              .catch(() => {
                callback("token request failed", null);
              });
          },
        });
        const trigger = () => syncRef.current();
        // Typing travels on its own channel, so every event here is a reason
        // to fetch.
        const handleTyping = (message: {
          name?: string;
          clientId?: string;
        }) => {
          if (
            cancelled ||
            message.name !== CHAT_EVENTS.TYPING ||
            !isTypingFromPeer(
              message.clientId,
              role,
              client.auth.clientId ?? null,
              userId,
            )
          ) {
            return;
          }
          // The indicator expires on its own if the peer goes quiet.
          if (typingTimer.current !== null) {
            clearTimeout(typingTimer.current);
          }
          setIsPeerTypingNow(true);
          typingTimer.current = setTimeout(() => {
            typingTimer.current = null;
            setIsPeerTypingNow(false);
          }, TYPING_EXPIRY_MS);
        };

        close = () => client.close();
        client.connection.on((change) => {
          if (cancelled || change.current === "closed") {
            return;
          }
          connectedRef.current = change.current === "connected";
          setState(realtimeStateFor(change.current));
          if (change.current === "connected") {
            // One gap-fill after every (re)connect.
            trigger();
          }
        });
        // subscribe() also attaches; if the client is closed meanwhile (no
        // key, locked) the attach rejects, and polling already covers that.
        const ignore = () => undefined;

        client.channels
          .get(
            groupId !== null
              ? groupChannel(groupId)
              : conversationChannel(conversationId ?? 0),
          )
          .subscribe(trigger)
          .catch(ignore);
        if (groupId === null && conversationId !== null) {
          // Browsers publish and subscribe here, nowhere else.
          const typing = client.channels.get(typingChannel(conversationId));

          typingChannelRef.current = typing;
          typing.subscribe(handleTyping).catch(ignore);
        }
        if (role === "user" && groupId === null) {
          client.channels
            .get(userChannel(userId))
            .subscribe(trigger)
            .catch(ignore);
        }
      } catch {
        if (!cancelled) {
          setState("unavailable");
        }
      }
    };

    void connect();
    return () => {
      cancelled = true;
      connectedRef.current = false;
      typingChannelRef.current = null;
      close?.();
      clearPeerTyping();
    };
  }, [canConnect, conversationId, groupId, role, userId, clearPeerTyping]);

  // Throttled, fire and forget. Polling-only mode (no live connection) sends
  // nothing, so there is no request and no error to handle.
  const sendTyping = useCallback(() => {
    const now = Date.now();

    if (
      !connectedRef.current ||
      groupId !== null ||
      conversationId === null ||
      !shouldSendTyping(lastTypingSentAt.current, now)
    ) {
      return;
    }
    lastTypingSentAt.current = now;
    // Straight to Ably: no request to our server. A failed publish only means
    // the indicator does not show.
    typingChannelRef.current
      ?.publish(CHAT_EVENTS.TYPING, null)
      .catch(() => undefined);
  }, [conversationId, groupId]);

  // Pause while the tab is hidden; fetch once on return.
  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";

      setIsHidden(hidden);
      if (!hidden) {
        syncRef.current();
      }
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Without a token scope (locked, no conversation) there is nothing to
  // connect to, whatever the last connection state was.
  const effectiveState = canConnect ? state : "unavailable";
  const interval = pollIntervalFor(effectiveState, isHidden);

  useEffect(() => {
    if (interval === null) {
      return;
    }
    const timer = setInterval(() => {
      if (!isUserIdle()) {
        syncRef.current();
      }
    }, interval);
    // One catch-up sync when the user returns from idle.
    const offActive = onUserActive(() => syncRef.current());

    return () => {
      clearInterval(timer);
      offActive();
    };
  }, [interval]);

  return {
    realtimeState: effectiveState,
    isPeerTyping: canConnect && isPeerTypingNow,
    clearPeerTyping,
    sendTyping,
  };
};
