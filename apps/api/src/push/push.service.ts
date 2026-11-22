import { Inject, Injectable } from "@nestjs/common";
import type { PushKind, PushPayload } from "@pt/contracts";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";

import { Clock } from "../common/clock.js";
import type { StoredPushSubscription } from "./push-sender.js";
import { PUSH_SENDERS, type PushSender } from "./push-sender.js";
import { PushSubscriptionStore } from "./push-subscription.store.js";

// Total attempts for one device (a temporary failure is tried again after a
// short wait, 250 ms then 500 ms).
export const PUSH_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

// The context of the sender strategy: sends to every device of an owner, each
// through the sender of its `kind`, and deletes the devices that answer gone.
// Never throws and never logs a payload (it carries message text).
@Injectable()
export class PushService {
  private readonly byKind: Map<PushKind, PushSender>;

  constructor(
    @Inject(PUSH_SENDERS) senders: PushSender[],
    private readonly store: PushSubscriptionStore,
    private readonly clock: Clock,
    @InjectPinoLogger(PushService.name) private readonly logger: PinoLogger,
  ) {
    this.byKind = new Map(senders.map((sender) => [sender.kind, sender]));
  }

  // At least one sender is configured; the listeners skip all their queries
  // otherwise.
  isEnabled() {
    return [...this.byKind.values()].some((sender) => sender.enabled);
  }

  isKindEnabled(kind: PushKind) {
    return this.byKind.get(kind)?.enabled ?? false;
  }

  async hasDevices(ownerKey: string) {
    return (await this.store.count(ownerKey)) > 0;
  }

  async sendToOwner(ownerKey: string, payload: PushPayload) {
    try {
      const subscriptions = await this.store.listFor(ownerKey);

      const byKind = new Map<PushKind, StoredPushSubscription[]>();

      for (const subscription of subscriptions) {
        byKind.set(subscription.kind, [
          ...(byKind.get(subscription.kind) ?? []),
          subscription,
        ]);
      }
      await Promise.all(
        [...byKind].map(([kind, group]) =>
          this.sendGroup(kind, group, payload),
        ),
      );
    } catch (error) {
      this.logger.error({ err: error }, "Push to owner failed");
    }
  }

  // The devices of one kind. A sender with sendMany (Expo) gets them in one
  // call and only the temporary failures are tried again.
  private async sendGroup(
    kind: PushKind,
    group: StoredPushSubscription[],
    payload: PushPayload,
  ) {
    const sender = this.byKind.get(kind);

    if (!sender?.enabled) {
      return;
    }
    if (!sender.sendMany) {
      await Promise.all(group.map((sub) => this.sendToDevice(sub, payload)));
      return;
    }
    let pending = group;

    try {
      for (let attempt = 1; attempt <= PUSH_MAX_ATTEMPTS; attempt += 1) {
        const results = await sender.sendMany(pending, payload);
        const retry: StoredPushSubscription[] = [];

        for (const subscription of pending) {
          const result = results.get(subscription.id) ?? "failed";

          if (result === "ok") {
            await this.store.markSuccess(subscription.id, this.clock.now());
          } else if (result === "gone") {
            await this.store.delete(subscription.id);
          } else if (result === "retry") {
            retry.push(subscription);
          }
        }
        pending = retry;
        if (pending.length === 0) {
          return;
        }
        if (attempt < PUSH_MAX_ATTEMPTS) {
          await this.clock.sleep(RETRY_DELAY_MS * attempt);
        }
      }
      this.logger.warn({ kind, devices: pending.length }, "Push not delivered");
    } catch (error) {
      this.logger.error({ err: error, kind }, "Push sender threw");
    }
  }

  private async sendToDevice(
    subscription: StoredPushSubscription,
    payload: PushPayload,
  ) {
    const sender = this.byKind.get(subscription.kind);

    // The kind is not switched on (yet): leave the device alone.
    if (!sender?.enabled) {
      return;
    }
    try {
      for (let attempt = 1; attempt <= PUSH_MAX_ATTEMPTS; attempt += 1) {
        const result = await sender.send(subscription, payload);

        if (result === "ok") {
          await this.store.markSuccess(subscription.id, this.clock.now());
          return;
        }
        if (result === "gone") {
          await this.store.delete(subscription.id);
          return;
        }
        if (result === "failed") {
          break;
        }
        if (attempt < PUSH_MAX_ATTEMPTS) {
          await this.clock.sleep(RETRY_DELAY_MS * attempt);
        }
      }
      this.logger.warn(
        { subscriptionId: subscription.id, kind: subscription.kind },
        "Push not delivered",
      );
    } catch (error) {
      this.logger.error(
        { err: error, subscriptionId: subscription.id },
        "Push sender threw",
      );
    }
  }
}
