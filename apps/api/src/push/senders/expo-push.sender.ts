import { Inject, Injectable } from "@nestjs/common";
import type { PushPayload } from "@pt/contracts";

import { APP_ENV } from "../../config/app-config.module.js";
import type { Env } from "../../config/env.schema.js";
import type {
  PushSender,
  PushSendResult,
  StoredPushSubscription,
} from "../push-sender.js";

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// The Expo push service accepts at most 100 messages per request.
export const EXPO_BATCH_SIZE = 100;
const PUSH_TTL_SECONDS = 3600;

export type ExpoPushData = {
  url: string;
  tag: string;
  kind: string;
  ids: Record<string, number>;
};

// What the app needs to open the right screen, read from the push tag (the
// tags are the same ones the web uses to replace older notifications).
export const expoDataOf = (payload: PushPayload): ExpoPushData => {
  const { tag, url } = payload;
  const rules: [RegExp, string, string][] = [
    [/^chat-react-(\d+)$/, "chat_reaction", "conversationId"],
    [/^chat-group-(\d+)$/, "group_message", "groupId"],
    [/^chat-(\d+)$/, "chat_message", "conversationId"],
    [/^social-(?:react|comment|post)-(\d+)$/, "social", "postId"],
  ];

  for (const [pattern, kind, idName] of rules) {
    const match = pattern.exec(tag);

    if (match) {
      return { url, tag, kind, ids: { [idName]: Number(match[1]) } };
    }
  }
  return {
    url,
    tag,
    kind:
      tag === "reports"
        ? "report"
        : tag.startsWith("social-")
          ? "social"
          : "other",
    ids: {},
  };
};

type ExpoTicket = {
  status?: string;
  details?: { error?: string };
};

const classifyTicket = (ticket: ExpoTicket | undefined): PushSendResult => {
  if (ticket?.status === "ok") {
    return "ok";
  }
  if (ticket?.details?.error === "DeviceNotRegistered") {
    return "gone";
  }
  // MessageRateExceeded is temporary; everything else (bad token shape,
  // MessageTooBig, InvalidCredentials) will not change on a retry.
  return ticket?.details?.error === "MessageRateExceeded" ? "retry" : "failed";
};

// Expo push for the mobile app: the device token is stored in the
// subscription's `endpoint`. Always enabled: it needs no key (EXPO_ACCESS_TOKEN
// is only for projects that turned on enhanced push security).
@Injectable()
export class ExpoPushSender implements PushSender {
  readonly kind = "expo" as const;
  readonly enabled = true;

  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  async send(
    subscription: StoredPushSubscription,
    payload: PushPayload,
  ): Promise<PushSendResult> {
    const results = await this.sendMany([subscription], payload);

    return results.get(subscription.id) ?? "failed";
  }

  async sendMany(
    subscriptions: StoredPushSubscription[],
    payload: PushPayload,
  ): Promise<Map<number, PushSendResult>> {
    const results = new Map<number, PushSendResult>();

    for (let i = 0; i < subscriptions.length; i += EXPO_BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + EXPO_BATCH_SIZE);

      for (const [id, result] of await this.sendBatch(batch, payload)) {
        results.set(id, result);
      }
    }
    return results;
  }

  private async sendBatch(
    batch: StoredPushSubscription[],
    payload: PushPayload,
  ): Promise<Map<number, PushSendResult>> {
    const all = (result: PushSendResult) =>
      new Map(batch.map((sub) => [sub.id, result] as const));
    const data = expoDataOf(payload);
    const messages = batch.map((sub) => ({
      to: sub.endpoint,
      title: payload.title,
      body: payload.body,
      data,
      sound: "default",
      priority: "high",
      ttl: PUSH_TTL_SECONDS,
      channelId: "default",
      ...(payload.badge === undefined ? {} : { badge: payload.badge }),
    }));
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (this.env.EXPO_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${this.env.EXPO_ACCESS_TOKEN}`;
    }
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
      });

      if (response.status === 429 || response.status >= 500) {
        return all("retry");
      }
      if (!response.ok) {
        return all("failed");
      }
      const body = (await response.json()) as { data?: ExpoTicket[] };
      const tickets = Array.isArray(body.data) ? body.data : [];

      return new Map(
        batch.map((sub, index) => [sub.id, classifyTicket(tickets[index])]),
      );
    } catch {
      // No answer at all: temporary.
      return all("retry");
    }
  }
}
