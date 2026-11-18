import "server-only";

import { and, eq, inArray, like } from "drizzle-orm";
import { after } from "next/server";
import webpush from "web-push";

import { db } from "@/db";
import {
  adminHiddenUsers,
  admins as adminsTable,
  chatNicknames,
  pushSubscriptions,
  users,
} from "@/db/schema";
import { parseAdminTarget } from "@/features/chat/utils/chat-rules";
import { adminLabel } from "@/features/chat/utils/chat-settings";
import { displayNameFor } from "@/features/chat/utils/display-name";
import {
  ADMIN_OWNER_PREFIX,
  adminOwnerKey,
  buildChatPushPayload,
  buildReactionPushPayload,
  type ChatPushPayload,
  isGoneStatus,
  type PushSubscriptionInput,
  userOwnerKey,
} from "@/features/chat/utils/push-rules";
import { loadAliasesForOwners } from "@/features/contact-aliases/services/contact-aliases";
import {
  adminActorKey,
  overlayName,
  PT_ALIAS_TARGET,
  userActorKey,
} from "@/features/contact-aliases/utils/alias-rules";
import { getPushTranslator } from "@/i18n/push-translator";
import { isUserInAdminScope, toAdminRole } from "@/services/admin-scope";
import { getVapidConfig } from "@/services/env";
import { isUserHidden } from "@/services/hidden-users";
import { logServerError } from "@/services/logger";
import { type Locale, parseLocale } from "@/utils/locale";

const PUSH_TTL_SECONDS = 3600;

type StoredSubscription = typeof pushSubscriptions.$inferSelect;
type VapidConfig = NonNullable<ReturnType<typeof getVapidConfig>>;

// Resolves on delivery; rejects with an error carrying `statusCode` (the
// web-push WebPushError shape) otherwise.
export type PushSender = (
  subscription: Pick<StoredSubscription, "endpoint" | "p256dh" | "auth">,
  payload: ChatPushPayload,
  vapid: VapidConfig,
) => Promise<unknown>;

export const sendWithWebPush: PushSender = (subscription, payload, vapid) =>
  webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    {
      vapidDetails: {
        subject: vapid.subject,
        publicKey: vapid.publicKey,
        privateKey: vapid.privateKey,
      },
      TTL: PUSH_TTL_SECONDS,
      urgency: "high",
      topic: payload.tag,
    },
  );

let warned = false;

// Test seam: forget the one-time warning.
export const resetChatPushForTests = () => {
  warned = false;
};

export const getVapid = () => {
  const config = getVapidConfig();

  if (!config && !warned) {
    warned = true;
    console.warn("[pt-app] VAPID_* missing: web push is skipped");
  }
  return config;
};

// A browser re-subscribing, or another account on the same device, reuses the
// endpoint: the row just changes owner.
export const saveSubscription = async (
  ownerKey: string,
  subscription: PushSubscriptionInput,
  userAgent: string,
) => {
  const values = {
    ownerKey,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent.slice(0, 255),
  };

  await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        ownerKey: values.ownerKey,
        p256dh: values.p256dh,
        auth: values.auth,
        userAgent: values.userAgent,
      },
    });
};

// Scoped to the owner: nobody can remove another account's subscription by
// guessing its endpoint.
export const deleteSubscription = async (
  ownerKey: string,
  endpoint: string,
) => {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.ownerKey, ownerKey),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );
};

export interface SendChatPushInput {
  // Who wrote the message; the other side gets the push.
  senderRole: "user" | "admin";
  traineeUserId: number;
  conversationId: number;
  // The sending admin (for the push title when the trainee is notified).
  senderAdminId?: number | null;
  // Message text for the push preview; never logged.
  body?: string | null;
  // The message is a sticker (the preview becomes a kind label).
  sticker?: boolean;
  // The message carries a photo (KAN-160): the preview becomes a kind label.
  photo?: boolean;
  // How many photos when it carries several (the preview names the count).
  photoCount?: number;
}

const loadTargets = async (
  senderRole: "user" | "admin",
  traineeUserId: number,
) => {
  if (senderRole === "admin") {
    return db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.ownerKey, userOwnerKey(traineeUserId)));
  }
  const [targets, hidden, admins] = await Promise.all([
    db
      .select()
      .from(pushSubscriptions)
      .where(like(pushSubscriptions.ownerKey, `${ADMIN_OWNER_PREFIX}%`)),
    db
      .select({ adminId: adminHiddenUsers.adminId })
      .from(adminHiddenUsers)
      .where(eq(adminHiddenUsers.userId, traineeUserId)),
    db.select({ id: adminsTable.id, role: adminsTable.role }).from(adminsTable),
  ]);
  const hiddenKeys = new Set(hidden.map((row) => adminOwnerKey(row.adminId)));
  const [trainee] = await db
    .select({ ptAdminId: users.ptAdminId })
    .from(users)
    .where(eq(users.id, traineeUserId));
  // P1: super admins plus this trainee's own PT; other PTs get nothing.
  const outOfScopeKeys = new Set(
    admins
      .filter(
        (admin) =>
          toAdminRole(admin.role) === "pt" &&
          admin.id !== (trainee?.ptAdminId ?? null),
      )
      .map((admin) => adminOwnerKey(admin.id)),
  );

  // KAN-163: an admin who hid this trainee gets no push for them.
  return targets.filter(
    (target) =>
      !hiddenKeys.has(target.ownerKey) && !outOfScopeKeys.has(target.ownerKey),
  );
};

// The conversation's shared nicknames, by "user" / "pt" / "admin:<id>".
const loadNicknames = async (conversationId: number) => {
  const rows = await db
    .select({
      targetKey: chatNicknames.targetKey,
      nickname: chatNicknames.nickname,
    })
    .from(chatNicknames)
    .where(eq(chatNicknames.conversationId, conversationId));

  return Object.fromEntries(rows.map((row) => [row.targetKey, row.nickname]));
};

const ownerIdOf = (ownerKey: string, prefix: string) =>
  ownerKey.startsWith(prefix) ? Number(ownerKey.slice(prefix.length)) : NaN;

// The language each push recipient chose (users.locale / admins.locale, null
// = Vietnamese), keyed by owner key. A push is built per recipient language,
// not from the sender's or the request's.
export const loadOwnerLocales = async (
  ownerKeys: string[],
): Promise<Map<string, Locale>> => {
  const userIds = ownerKeys
    .map((key) => ownerIdOf(key, "user:"))
    .filter(Number.isFinite);
  const adminIds = ownerKeys
    .map((key) => ownerIdOf(key, ADMIN_OWNER_PREFIX))
    .filter(Number.isFinite);
  const [userRows, adminRows] = await Promise.all([
    userIds.length
      ? db
          .select({ id: users.id, locale: users.locale })
          .from(users)
          .where(inArray(users.id, userIds))
      : [],
    adminIds.length
      ? db
          .select({ id: adminsTable.id, locale: adminsTable.locale })
          .from(adminsTable)
          .where(inArray(adminsTable.id, adminIds))
      : [],
  ]);

  return new Map<string, Locale>([
    ...userRows.map(
      (row) => [userOwnerKey(row.id), parseLocale(row.locale)] as const,
    ),
    ...adminRows.map(
      (row) => [adminOwnerKey(row.id), parseLocale(row.locale)] as const,
    ),
  ]);
};

// Sends one payload per recipient language and per shown name. `nameFor`
// returns the name a given recipient sees for the sender (their private
// alias, say); recipients that resolve to the same locale and name share one
// payload. Owners without a stored locale (or no longer in the database) get
// Vietnamese.
export const deliverLocalizedNamed = async (
  targets: StoredSubscription[],
  nameFor: (ownerKey: string) => string | undefined,
  buildPayload: (locale: Locale, name: string | undefined) => ChatPushPayload,
  vapid: VapidConfig,
  sender: PushSender,
) => {
  const locales = await loadOwnerLocales([
    ...new Set(targets.map((target) => target.ownerKey)),
  ]);
  const groups = new Map<
    string,
    { locale: Locale; name: string | undefined; targets: StoredSubscription[] }
  >();

  for (const target of targets) {
    const locale = locales.get(target.ownerKey) ?? parseLocale(null);
    const name = nameFor(target.ownerKey);
    const groupKey = `${locale}\u0000${name ?? ""}\u0000${name === undefined}`;
    const group = groups.get(groupKey) ?? { locale, name, targets: [] };

    group.targets.push(target);
    groups.set(groupKey, group);
  }
  await Promise.all(
    [...groups.values()].map((group) =>
      deliver(
        group.targets,
        buildPayload(group.locale, group.name),
        vapid,
        sender,
      ),
    ),
  );
};

// Sends one payload per recipient language. Owners without a stored locale
// (or no longer in the database) get Vietnamese.
export const deliverLocalized = (
  targets: StoredSubscription[],
  buildPayload: (locale: Locale) => ChatPushPayload,
  vapid: VapidConfig,
  sender: PushSender,
) =>
  deliverLocalizedNamed(
    targets,
    () => undefined,
    (locale) => buildPayload(locale),
    vapid,
    sender,
  );

export const deliver = async (
  targets: StoredSubscription[],
  payload: ChatPushPayload,
  vapid: VapidConfig,
  sender: PushSender,
) => {
  await Promise.all(
    targets.map(async (target) => {
      try {
        await sender(target, payload, vapid);
        await db
          .update(pushSubscriptions)
          .set({ lastSuccessAt: new Date() })
          .where(eq(pushSubscriptions.id, target.id));
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;

        if (isGoneStatus(statusCode)) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, target.id));
          return;
        }
        logServerError("sendChatPush", error, {
          subscriptionId: target.id,
          statusCode,
        });
      }
    }),
  );
};

// Never throws and never logs the payload or any message body (the body is
// in the push preview since 2026-11-09, owner request): only ids and counts.
// Trainee message -> every admin's devices; admin message -> the trainee's
// devices. 404/410 means the subscription is dead and is dropped.
export const sendChatPush = async (
  {
    senderRole,
    traineeUserId,
    conversationId,
    senderAdminId,
    body,
    sticker,
    photo,
    photoCount,
  }: SendChatPushInput,
  sender: PushSender = sendWithWebPush,
) => {
  try {
    const vapid = getVapid();

    if (!vapid) {
      return;
    }
    const targets = await loadTargets(senderRole, traineeUserId);

    if (targets.length === 0) {
      return;
    }
    const recipientRole = senderRole === "user" ? "admin" : "user";
    // Name precedence per recipient: their private contact alias for the
    // sender, then the conversation's shared nickname, then the real name.
    const nicknames = await loadNicknames(conversationId);
    let traineeName: string | null = null;
    let adminName = "PT";

    if (recipientRole === "admin") {
      const [trainee] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, traineeUserId));

      traineeName = trainee?.name ?? null;
    } else if (senderAdminId != null) {
      const [admin] = await db
        .select({ username: adminsTable.username })
        .from(adminsTable)
        .where(eq(adminsTable.id, senderAdminId));

      adminName = admin?.username ?? "PT";
    }
    // Aliases are owner-keyed, so only each recipient's own row can apply.
    const aliasTargets =
      recipientRole === "admin"
        ? [userActorKey(traineeUserId)]
        : [
            ...(senderAdminId != null ? [adminActorKey(senderAdminId)] : []),
            PT_ALIAS_TARGET,
          ];
    const aliases = await loadAliasesForOwners(
      targets.map((target) => target.ownerKey),
      aliasTargets,
    );
    const sharedName = (locale: Locale) =>
      recipientRole === "admin"
        ? displayNameFor(
            nicknames,
            "user",
            traineeName ?? getPushTranslator(locale)("traineeFallback"),
          )
        : senderAdminId != null
          ? adminLabel(nicknames, senderAdminId, adminName, "pt")
          : adminName;
    const privateAlias = (ownerKey: string) => {
      const own = aliases.get(ownerKey);

      if (!own) {
        return undefined;
      }
      if (recipientRole === "admin") {
        return overlayName(own, userActorKey(traineeUserId), "") || undefined;
      }
      return (
        (senderAdminId != null
          ? overlayName(own, adminActorKey(senderAdminId), "")
          : "") ||
        overlayName(own, PT_ALIAS_TARGET, "") ||
        undefined
      );
    };

    await deliverLocalizedNamed(
      targets,
      privateAlias,
      (locale, alias) =>
        buildChatPushPayload({
          recipientRole,
          senderName: alias ?? sharedName(locale),
          traineeUserId,
          conversationId,
          body,
          sticker,
          photo,
          photoCount,
          locale,
        }),
      vapid,
      sender,
    );
  } catch (error) {
    logServerError("sendChatPush", error, { conversationId });
  }
};

export interface SendReactionPushInput {
  // The author of the reacted message, the only person who is notified.
  recipient:
    | { role: "user"; userId: number }
    | { role: "admin"; adminId: number };
  reactorName: string;
  // The reactor's chat key ("user" / "admin:<id>"): the conversation's shared
  // nickname for them, if any, replaces `reactorName`.
  reactorKey?: string;
  emoji: string;
  traineeUserId: number;
  conversationId: number;
}

// Never throws; the payload carries the reactor, the emoji and a link, never
// the message text. The caller has already ruled out self-reactions.
export const sendReactionPush = async (
  {
    recipient,
    reactorName,
    reactorKey,
    emoji,
    traineeUserId,
    conversationId,
  }: SendReactionPushInput,
  sender: PushSender = sendWithWebPush,
) => {
  try {
    const vapid = getVapid();

    if (!vapid) {
      return;
    }
    if (
      recipient.role === "admin" &&
      ((await isUserHidden(recipient.adminId, traineeUserId)) ||
        !(await isUserInAdminScope(recipient.adminId, traineeUserId)))
    ) {
      return;
    }
    const targets = await db
      .select()
      .from(pushSubscriptions)
      .where(
        eq(
          pushSubscriptions.ownerKey,
          recipient.role === "user"
            ? userOwnerKey(recipient.userId)
            : adminOwnerKey(recipient.adminId),
        ),
      );

    if (targets.length === 0) {
      return;
    }
    // The recipient's private alias for the reactor wins, then the
    // conversation's shared nickname (a trainee also sees the one for the
    // whole PT side), then the real name.
    const nicknames = await loadNicknames(conversationId);
    const adminId = reactorKey ? parseAdminTarget(reactorKey) : null;
    const sharedName =
      !reactorKey || reactorKey.startsWith("admin:")
        ? adminLabel(
            nicknames,
            adminId,
            reactorName,
            recipient.role === "user" ? "pt" : undefined,
          )
        : displayNameFor(nicknames, reactorKey, reactorName);
    const recipientKey =
      recipient.role === "user"
        ? userOwnerKey(recipient.userId)
        : adminOwnerKey(recipient.adminId);
    // The reactor's actor key: "user" means this conversation's trainee.
    const reactorActorKey = !reactorKey
      ? null
      : reactorKey === "user"
        ? userActorKey(traineeUserId)
        : reactorKey;
    const alias = reactorActorKey
      ? (await loadAliasesForOwners([recipientKey], [reactorActorKey]))
          .get(recipientKey)
          ?.get(reactorActorKey)
          ?.trim()
      : undefined;
    const shownName = alias ? alias : sharedName;

    await deliverLocalized(
      targets,
      (locale) =>
        buildReactionPushPayload({
          recipientRole: recipient.role,
          reactorName: shownName,
          emoji,
          traineeUserId,
          conversationId,
          locale,
        }),
      vapid,
      sender,
    );
  } catch (error) {
    logServerError("sendReactionPush", error, { conversationId });
  }
};

// Called after a NEW message was stored. Runs after the response when inside
// a request (Next's after()), otherwise fire-and-forget; either way the send
// never blocks or fails the action.
export const schedulePush = (input: SendChatPushInput) => {
  try {
    after(() => sendChatPush(input));
  } catch {
    void sendChatPush(input);
  }
};

export const scheduleReactionPush = (input: SendReactionPushInput) => {
  try {
    after(() => sendReactionPush(input));
  } catch {
    void sendReactionPush(input);
  }
};
