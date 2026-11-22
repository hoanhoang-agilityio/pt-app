import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppState } from "react-native";

import { useAuth } from "@/features/auth/auth-context";
import { type PresenceText, presenceView } from "@/lib/presence";
import { qk } from "@/lib/query-keys";

import { fetchPeerPresence, sendHeartbeat } from "./api-manage";

const HEARTBEAT_MS = 60_000;

// "I have the app open": a heartbeat now and every minute while the app is in
// the foreground (the API also slides an admin's unlock window with it).
export const PresenceHeartbeat = () => {
  const { state } = useAuth();
  const active =
    state.status === "signedIn" && !(state.me.actor.kind === "admin" && state.me.actor.locked);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const beat = () => {
      if (AppState.currentState === "active") {
        void sendHeartbeat().catch(() => undefined);
      }
    };
    const timer = setInterval(beat, HEARTBEAT_MS);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        beat();
      }
    });

    beat();
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [active]);

  return null;
};

// The other side of a coach chat: the PT team for a trainee (`userId` null),
// the trainee for an admin. Refreshed every minute and on presence events.
export const usePeerPresence = (userId: number | null, enabled: boolean): PresenceText => {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: qk.presence(userId),
    queryFn: () => fetchPeerPresence(userId),
    enabled,
    refetchInterval: HEARTBEAT_MS,
    retry: false,
  });

  return presenceView(query.data, {
    online: t("presence.online"),
    now: t("time.now"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
    lastSeen: (when) => t("presence.lastSeen", { when }),
  });
};
