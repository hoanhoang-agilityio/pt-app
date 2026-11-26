// Poll schedule for the unread badge. Pure, so the rules are testable.

// Nothing live tells the badge about new messages: poll every 30 s. This poll
// also carries the presence heartbeat (and the peer's last-seen), so it must
// stay under the 60 s heartbeat throttle and the 120 s online window.
export const UNREAD_POLL_MS = 30_000;
// An Ably inbox connection already pushes every change (and fires the
// refresh event), so the poll is only a safety net for a missed event.
export const UNREAD_SAFETY_POLL_MS = 60_000;

export const unreadPollMs = (realtimeConnected: boolean) =>
  realtimeConnected ? UNREAD_SAFETY_POLL_MS : UNREAD_POLL_MS;
