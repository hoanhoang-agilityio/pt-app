// Poll schedule for the unread badge. Pure, so the rules are testable.

// Nothing live tells the badge about new messages: poll every 30 s. This poll
// also carries the presence heartbeat (and the peer's last-seen).
export const UNREAD_POLL_MS = 30_000;
// An Ably inbox connection already pushes every change (and fires the
// refresh event), so the poll is only a safety net for a missed event. It
// still carries the heartbeat, whose write is throttled to one a minute: it
// stays under 60 s so jitter never skips a minute (online lasts 120 s).
export const UNREAD_SAFETY_POLL_MS = 55_000;

export const unreadPollMs = (realtimeConnected: boolean) =>
  realtimeConnected ? UNREAD_SAFETY_POLL_MS : UNREAD_POLL_MS;
