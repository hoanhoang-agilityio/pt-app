// "Online" and "last seen" text of the peer in a chat header. The server clock
// (`serverNow`) judges online-ness, never the phone's.

export type PresenceText = {
  online: boolean;
  // Null = never seen: the header shows nothing.
  text: string | null;
};

export type PresenceLabels = {
  online: string;
  now: string;
  minutes: string;
  hours: string;
  days: string;
  // "Active {{when}} ago"
  lastSeen: (when: string) => string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Time since the peer was last seen: "just now", "5 min", "3 h", "2 d".
export const sinceText = (
  lastSeenAt: string,
  nowIso: string,
  labels: Pick<PresenceLabels, "now" | "minutes" | "hours" | "days">,
) => {
  const diff = Math.max(0, Date.parse(nowIso) - Date.parse(lastSeenAt));

  if (Number.isNaN(diff) || diff < MINUTE) {
    return labels.now;
  }
  if (diff < HOUR) {
    return labels.minutes.replace("{{count}}", String(Math.floor(diff / MINUTE)));
  }
  if (diff < DAY) {
    return labels.hours.replace("{{count}}", String(Math.floor(diff / HOUR)));
  }
  return labels.days.replace("{{count}}", String(Math.floor(diff / DAY)));
};

export const presenceView = (
  peer: { peerLastSeenAt: string | null; serverNow: string; peerOnline: boolean } | undefined,
  labels: PresenceLabels,
): PresenceText => {
  if (!peer) {
    return { online: false, text: null };
  }
  if (peer.peerOnline) {
    return { online: true, text: labels.online };
  }
  if (!peer.peerLastSeenAt) {
    return { online: false, text: null };
  }
  return {
    online: false,
    text: labels.lastSeen(sinceText(peer.peerLastSeenAt, peer.serverNow, labels)),
  };
};
