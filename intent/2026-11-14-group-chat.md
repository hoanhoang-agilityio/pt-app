# Intent: Group chat for trainees and PTs

- **Author:** Hoan
- **Status:** accepted
- **Jira:** none (owner decision 2026-11-14)

## Problem

Chat in pt-app is one to one: each trainee talks with the PT side in a private coach chat, and trainee-to-trainee chat is turned off (2026-11-09). A PT who coaches a class or a small team still runs that group in Zalo or Messenger, away from the workouts and meals. Trainees in the same team cannot encourage each other inside the app, and the super admin has no view of how a PT runs a team.

## Proposed outcome

- A super admin or a PT creates a named group chat (with an optional group photo) and adds members. A PT adds only their own trainees; a super admin can add any trainee and other PTs.
- Every super admin is always inside every group (labelled "Manager"), sees all of it, and can mute it.
- Members send text, stickers and photos, react, reply, edit, unsend and report messages, like in the coach chat. Messages show who has seen them.
- By default everyone can send; the super admin or the creator PT can switch a group to "managers only can send".
- Trainees see each other's messages in the group but still cannot open a one to one chat from it.
- Members get a push for each message (except their own, and unless they muted the group) and an unread badge.
- When a trainee's PT changes while they are in a group, the super admin sees a line in that group asking whether to keep or remove the trainee.
- Super admins and the creator PT manage the group: add or remove members, rename, change the photo, hide a message, switch managers-only. Only a super admin can dissolve a group.

## Affected users and systems

Super admins, PTs, trainees. New tables for groups, members, messages, reactions, edits and photos; the Ably channel `chat:group:<id>`; chat push; the admin Messages inbox and the trainee Messages page; the unread payload; `assignTraineePtAction` (PT change alert); member and PT deletion cleanup; `social_reports` (new target kind). The block / restrict feature that is being built in parallel supplies the "cannot send" rule.

## Constraints

- Schema changes are additive only (new tables, nullable columns); the Vercel build pushes the schema to production.
- UI copy in Vietnamese (vi default, en and zh keys too); code, comments and docs in English.
- Keep the 2026-11-09 rule: no trainee-to-trainee one to one chat.
- Ably key only covers `chat:*`; capabilities are per group id, never a wildcard.
- Built in three PRs into `main`. The core PR waits until the block and report PRs are merged. No Jira, no e2e (owner decisions).

## Open questions

None. All product decisions were taken by the owner on 2026-11-14 and are recorded in `docs/specs/group-chat.md`.

## Out of scope

- Floating chat bubbles for groups (phase 2, later).
- Trainee-to-trainee one to one chat, calls, typing indicators, presence, in-group search and gallery, polls, @mentions, pinned messages.
- Realtime inbox refresh for groups (the inbox and badge use the polled unread payload in this phase).
- Group invite links, join requests, more than 50 members per group.
