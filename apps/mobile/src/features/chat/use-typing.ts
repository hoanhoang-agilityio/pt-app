import { REALTIME_EVENTS } from "@pt/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  isPeerTypingEvent,
  shouldSendTyping,
  TYPING_EXPIRY_MS,
} from "@/lib/realtime-events";

import { useRealtime, useRealtimeListener } from "./realtime";

// Typing for the coach chat: sends a throttled "typing" while the user types
// and reports whether the other side is typing (it expires by itself).
export const useTyping = ({
  conversationId,
  myRole,
  myKey,
}: {
  conversationId: number | null;
  myRole: "user" | "admin";
  myKey: string;
}) => {
  const { emitTyping } = useRealtime();
  const [peerTyping, setPeerTyping] = useState(false);
  const lastSent = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useRealtimeListener({
    onEvent: (name, data) => {
      if (name !== REALTIME_EVENTS.typing || !isPeerTypingEvent(data, myRole, myKey)) {
        return;
      }
      const target = (data as { conversationId?: unknown }).conversationId;

      if (conversationId !== null && typeof target === "number" && target !== conversationId) {
        return;
      }
      setPeerTyping(true);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setPeerTyping(false), TYPING_EXPIRY_MS);
    },
  });

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const onTyping = useCallback(() => {
    const now = Date.now();

    if (shouldSendTyping(lastSent.current, now)) {
      lastSent.current = now;
      emitTyping(conversationId);
    }
  }, [emitTyping, conversationId]);

  return { peerTyping, onTyping };
};
