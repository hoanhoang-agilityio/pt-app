import "server-only";

import { inArray } from "drizzle-orm";
import { after } from "next/server";

import { ROUTES } from "@/constants/routes";
import { db } from "@/db";
import { admins, pushSubscriptions } from "@/db/schema";
import {
  deliverLocalized,
  getVapid,
  type PushSender,
  sendWithWebPush,
} from "@/features/chat/services/chat-push";
import {
  adminOwnerKey,
  type ChatPushPayload,
  PUSH_TITLE,
} from "@/features/chat/utils/push-rules";
import type { ReportTargetKind } from "@/features/social/utils/friend-rules";
import { getPushTranslator } from "@/i18n/push-translator";
import { toAdminRole } from "@/services/admin-scope";
import { logServerError } from "@/services/logger";
import type { Locale } from "@/utils/locale";

export const buildReportPushPayload = (
  kind: ReportTargetKind,
  locale: Locale,
): ChatPushPayload => {
  const t = getPushTranslator(locale);

  return {
    title: PUSH_TITLE,
    body: t("report", { kind: t(`reportKinds.${kind}`) }),
    url: ROUTES.ADMIN_REPORTS,
    tag: "reports",
  };
};

// Tells every super admin device about a new report. Never throws and never
// carries the reported content, only its kind.
export const sendReportPush = async (
  kind: ReportTargetKind,
  sender: PushSender = sendWithWebPush,
) => {
  try {
    const vapid = getVapid();

    if (!vapid) {
      return;
    }
    const adminRows = await db
      .select({ id: admins.id, role: admins.role })
      .from(admins);
    const ownerKeys = adminRows
      .filter((admin) => toAdminRole(admin.role) === "super_admin")
      .map((admin) => adminOwnerKey(admin.id));

    if (ownerKeys.length === 0) {
      return;
    }
    const targets = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.ownerKey, ownerKeys));

    await deliverLocalized(
      targets,
      (locale) => buildReportPushPayload(kind, locale),
      vapid,
      sender,
    );
  } catch (error) {
    logServerError("sendReportPush", error, { kind });
  }
};

// After the response inside a request, otherwise fire-and-forget.
export const scheduleReportPush = (kind: ReportTargetKind) => {
  try {
    after(() => sendReportPush(kind));
  } catch {
    void sendReportPush(kind);
  }
};
