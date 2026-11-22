import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ErrorState, IconButton, Screen, Spinner, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { space } from "@/theme";

import { TermsGate } from "../social/components/TermsGate";
import { PostList } from "./components/PostList";
import { useFeed, useNotifications, useSocialMe } from "./hooks";

export const FeedScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const social = useSocialMe();
  const termsOk = social.data?.termsAccepted === true;
  const feed = useFeed(termsOk);
  const notifications = useNotifications();

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
        }}
      >
        <Txt size={24} weight="700">
          {t("feed.title")}
        </Txt>
        <View style={{ flexDirection: "row" }}>
          <IconButton
            name="notifications-outline"
            label={t("feed.notifications")}
            badge={notifications.unreadCount}
            onPress={() => router.push("/notifications" as string as Href)}
          />
          <IconButton
            name="add-circle-outline"
            label={t("feed.newPost")}
            onPress={() => router.push("/compose" as string as Href)}
          />
        </View>
      </View>
      {social.isPending ? (
        <Spinner />
      ) : social.isError ? (
        <ErrorState message={errorText(social.error)} onRetry={() => void social.refetch()} />
      ) : !termsOk ? (
        <TermsGate />
      ) : (
        <PostList
          posts={feed.posts}
          isPending={feed.isPending}
          isError={feed.isError}
          error={feed.error}
          isRefetching={feed.isRefetching}
          hasNextPage={feed.hasNextPage}
          isFetchingNextPage={feed.isFetchingNextPage}
          onRefresh={() => {
            void feed.refetch();
            void notifications.refetch();
          }}
          onEndReached={() => void feed.fetchNextPage()}
          emptyTitle={t("feed.empty")}
          emptyHint={t("feed.emptyHint")}
          errorText={errorText}
        />
      )}
    </Screen>
  );
};
