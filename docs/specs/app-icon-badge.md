# App icon badge (unread count on the home-screen icon)

No Jira ticket yet; owner request.

## Goal

Show the unread count as a badge on the installed PWA's home-screen icon (Badging API: `navigator.setAppBadge(n)` / `clearAppBadge()`; iOS 16.4+, Chrome and Edge desktop). When notifications are turned off in the app ("Thông báo đẩy" toggle), the badge is cleared and never set again.

## Decisions

- D1 Count = chat unread (trainee: coach + friend chats; admin: trainee chats) + group chat unread + unread social notifications. The server returns it as `appBadge` on `/api/chat/unread` (both the trainee and the `?as=admin` response); existing fields are unchanged. Summing lives in `sumAppBadge` (`features/app-badge/utils/app-badge-rules.ts`).
- D2 The badge is set only while ALL hold: Badging API exists, `Notification.permission === "granted"`, and this browser has a push subscription. Otherwise it is cleared. Count 0 clears. Decision in `appBadgeAction`.
- D3 `AppIconBadge` (client component, mounted in both protected layouts) reuses the shared unread poller (same URL and cadence as `useChatUnread`), so there is no extra polling. It is never paused, so on /messages and for trainees with chat disabled the social-notification part still counts.
- D4 The service worker refreshes the badge on every `push`, next to `showNotification` in the same `waitUntil` (iOS needs a notification per push). It fetches `/api/chat/unread` (`?as=admin` when the payload url starts with `/admin`; all admin pushes use `/admin...` urls) and sets or clears the badge. Failures never block the notification.
- D5 Turning "Thông báo đẩy" off deletes the push subscription, so the SW gets no more pushes and cannot set the badge; `disable()` also clears the badge and dispatches `app-badge:subscription-change`, which `AppIconBadge` listens to (re-checks the subscription and nudges the poller). `enable()` dispatches it too.
- D6 No new UI strings, no schema change.

## Test matrix

| Case                                                                                  | Where                     |
| ------------------------------------------------------------------------------------- | ------------------------- |
| sum of chats, groups, notifications; bad values count 0                               | `app-badge-rules.test.ts` |
| `appBadge` parsed, non-numbers ignored                                                | `app-badge-rules.test.ts` |
| set / clear (zero, no subscription, no permission) / none (unsupported, no count yet) | `app-badge-rules.test.ts` |
| `/api/chat/unread` returns `appBadge` for trainee and admin                           | `group-routes.test.ts`    |

## Manual iPhone check

1. Add the app to the home screen (Share, Add to Home Screen) and open it from the icon.
2. Gear menu, turn "Thông báo đẩy" on and allow notifications.
3. From another account send a message; the notification arrives and the icon shows a number.
4. Open the chat and read it; the number drops (within about 15 s, or at once on focus).
5. Turn "Thông báo đẩy" off; the number disappears.
6. Send another message; no notification and the icon stays clear. Turn it on again; the badge returns with the next message or poll.
