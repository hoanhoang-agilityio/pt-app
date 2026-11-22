import { REALTIME_EVENTS, REALTIME_NAMESPACE } from "@pt/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";

import { getSessionToken } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { invalidationsFor, isAuthRevoked } from "@/lib/realtime-events";

import { useAuth } from "../auth/auth-context";

// One Socket.IO connection for the signed-in session. The handshake sends the
// opaque session token (`auth: { token }`, mobile has no ticket and no Origin).
// Events carry ids only: the provider invalidates inbox lists and badges and
// forwards every event to the open threads, which fetch what is new. The
// connection closes in the background and reopens (with a gap-fill) when the
// app returns to the foreground.

export type RealtimeState = "connecting" | "connected" | "unavailable";
export type RealtimeListener = {
  onEvent?: (name: string, data: unknown) => void;
  // First connect and every reconnect / foreground return: fill the gap.
  onConnect?: () => void;
};

type RealtimeValue = {
  state: RealtimeState;
  subscribe: (listener: RealtimeListener) => () => void;
  emitTyping: (conversationId: number | null) => void;
  // Admins follow a conversation to hear its events.
  follow: (conversationId: number) => () => void;
};

const RealtimeContext = createContext<RealtimeValue | null>(null);

const FATAL_CODES = new Set([
  "unauthorized",
  "session_expired",
  "admin_locked",
  "origin_not_allowed",
]);

export const RealtimeProvider = ({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) => {
  const queryClient = useQueryClient();
  const { endSession } = useAuth();
  const [state, setState] = useState<RealtimeState>("connecting");
  const socketRef = useRef<Socket | null>(null);
  const listeners = useRef(new Set<RealtimeListener>());
  const followed = useRef(new Map<number, number>());

  const notifyConnect = useCallback(() => {
    listeners.current.forEach((listener) => listener.onConnect?.());
    for (const key of [
      ["chat"],
      ["social", "notifications"],
    ] as const) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("unavailable");
      return;
    }
    const socket = io(`${API_URL}${REALTIME_NAMESPACE}`, {
      // A fresh token on every attempt: it may have been rotated meanwhile.
      auth: (done) => done({ token: getSessionToken() ?? "" }),
      transports: ["websocket"],
      reconnectionDelayMax: 15_000,
      autoConnect: true,
    });

    socketRef.current = socket;
    socket.on("connect", () => {
      setState("connected");
      followed.current.forEach((_count, id) => {
        socket.emit(REALTIME_EVENTS.subscribe, { conversationId: id }, () => undefined);
      });
      notifyConnect();
    });
    socket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") {
        setState("connecting");
      }
    });
    socket.on("connect_error", (error: Error & { data?: { code?: string } }) => {
      if (error.data?.code && FATAL_CODES.has(error.data.code)) {
        socket.disconnect();
        setState("unavailable");
      } else {
        setState("connecting");
      }
    });
    socket.onAny((name: string, data: unknown) => {
      if (isAuthRevoked(name)) {
        socket.disconnect();
        void endSession();
        return;
      }
      for (const key of invalidationsFor(name)) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      listeners.current.forEach((listener) => listener.onEvent?.(name, data));
    });

    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        if (!socket.connected) {
          socket.connect();
        } else {
          notifyConnect();
        }
      } else if (next === "background") {
        socket.disconnect();
        setState("connecting");
      }
    });

    return () => {
      appState.remove();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, notifyConnect, queryClient, endSession]);

  const subscribe = useCallback((listener: RealtimeListener) => {
    listeners.current.add(listener);
    if (socketRef.current?.connected) {
      listener.onConnect?.();
    }
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const emitTyping = useCallback((conversationId: number | null) => {
    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit(
        REALTIME_EVENTS.typing,
        conversationId === null ? {} : { conversationId },
        () => undefined,
      );
    }
  }, []);

  const follow = useCallback((conversationId: number) => {
    const count = followed.current.get(conversationId) ?? 0;

    followed.current.set(conversationId, count + 1);
    if (count === 0 && socketRef.current?.connected) {
      socketRef.current.emit(
        REALTIME_EVENTS.subscribe,
        { conversationId },
        () => undefined,
      );
    }
    return () => {
      const left = (followed.current.get(conversationId) ?? 1) - 1;

      if (left <= 0) {
        followed.current.delete(conversationId);
        socketRef.current?.emit(
          REALTIME_EVENTS.unsubscribe,
          { conversationId },
          () => undefined,
        );
      } else {
        followed.current.set(conversationId, left);
      }
    };
  }, []);

  const value = useMemo(
    () => ({ state, subscribe, emitTyping, follow }),
    [state, subscribe, emitTyping, follow],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const value = useContext(RealtimeContext);

  if (!value) {
    throw new Error("useRealtime must be used inside RealtimeProvider");
  }
  return value;
};

// Registers `listener` for as long as the component is mounted.
export const useRealtimeListener = (listener: RealtimeListener) => {
  const { subscribe } = useRealtime();
  const ref = useRef(listener);

  useEffect(() => {
    ref.current = listener;
  });
  useEffect(
    () =>
      subscribe({
        onEvent: (name, data) => ref.current.onEvent?.(name, data),
        onConnect: () => ref.current.onConnect?.(),
      }),
    [subscribe],
  );
};
