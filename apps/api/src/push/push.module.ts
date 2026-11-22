import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ChatModule } from "../chat/chat.module.js";
import { PushController } from "./push.controller.js";
import { PushNotifier } from "./push.notifier.js";
import { PushRecipients } from "./push.recipients.js";
import { PushService } from "./push.service.js";
import { PUSH_SENDERS } from "./push-sender.js";
import { PushSubscriptionStore } from "./push-subscription.store.js";
import { ExpoPushSender } from "./senders/expo-push.sender.js";
import { WebPushSender } from "./senders/web-push.sender.js";

// Web push. Chat and Social only emit domain events; PushNotifier turns them
// into pushes, PushService sends each through the sender of the device's kind.
// The Expo sender serves the mobile app; an FcmPushSender is one more class and
// one more entry in `inject` below. Without the VAPID_* variables
// the web sender is disabled; the Expo sender is on unless EXPO_PUSH_ENABLED=false.
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [PushController],
  providers: [
    WebPushSender,
    ExpoPushSender,
    {
      provide: PUSH_SENDERS,
      useFactory: (...senders: unknown[]) => senders,
      inject: [WebPushSender, ExpoPushSender],
    },
    PushSubscriptionStore,
    PushRecipients,
    PushService,
    PushNotifier,
  ],
  exports: [PushService],
})
export class PushModule {}
