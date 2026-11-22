import { useQuery } from "@tanstack/react-query";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { formatListTime } from "@/lib/time";
import { useTheme } from "@/theme";

import { dmApi } from "../../chat/api";
import { ConversationView } from "../../chat/components/ConversationView";
import { useThread } from "../../chat/use-thread";
import { fetchAdminDmList } from "../api";
import { Banner, ListRow, Loaded, Page } from "../components/kit";
import { ak } from "../keys";
import { useIsSuperAdmin } from "../use-admin";

// Every trainee-to-trainee chat, read-only (super admin).
export const AdminDmListScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const isSuper = useIsSuperAdmin();
  const list = useQuery({ queryKey: ak.dm, queryFn: fetchAdminDmList, enabled: isSuper });
  const labels = { today: t("time.today"), yesterday: t("time.yesterday") };
  const now = new Date();

  if (!isSuper) {
    return (
      <Page title={t("admin.dm.title")}>
        <Banner text={t("admin.forbidden")} />
      </Page>
    );
  }
  return (
    <Page title={t("admin.dm.title")} onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      <Loaded query={list}>
        {(data) =>
          data.conversations.length === 0 ? (
            <Banner tone="info" text={t("admin.dm.empty")} />
          ) : (
            data.conversations.map((row) => (
              <ListRow
                key={row.id}
                title={`${row.lowName} · ${row.highName}`}
                subtitle={row.preview || t("chat.photoPreview")}
                right={
                  row.lastMessageAt ? (
                    <Txt size={12} tone="muted">
                      {formatListTime(row.lastMessageAt, now, currentLocale(), labels)}
                    </Txt>
                  ) : undefined
                }
                onPress={() => router.push(`/admin/dm/${row.id}` as string as Href)}
              />
            ))
          )
        }
      </Loaded>
    </Page>
  );
};

// A read-only thread; the viewer id is 0 so no bubble counts as "mine".
export const AdminDmThreadScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ cid: string }>();
  const conversationId = Number(params.cid);
  const { load } = useMemo(() => dmApi(conversationId, 0), [conversationId]);
  const thread = useThread<{ readOnly: boolean }>({
    target: { kind: "dm", conversationId },
    load,
    onRead: () => undefined,
  });

  return (
    <ConversationView
      title={t("admin.dm.title")}
      avatarName="DM"
      avatarUri={null}
      thread={thread as never}
      scope={{ kind: "dm" }}
      chat={null}
      color={{ bg: theme.accent, fg: theme.accentFg }}
      showSender
      seenMode="peer"
      banner={t("admin.dm.readOnly")}
    />
  );
};
