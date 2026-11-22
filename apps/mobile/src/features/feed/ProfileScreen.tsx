import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { isApiError } from "@/lib/errors";
import { useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { PostList } from "./components/PostList";
import { useProfile, useProfilePosts } from "./hooks";

const Stat = ({ value, label }: { value: number; label: string }) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Txt size={20} weight="700">
      {value}
    </Txt>
    <Txt tone="muted" size={12}>
      {label}
    </Txt>
  </View>
);

// Profile of `user:<id>` / `admin:<id>` with their posts (the API filters what
// the viewer may see).
export const ProfileScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const { key: rawKey } = useLocalSearchParams<{ key: string }>();
  const key = decodeURIComponent(String(rawKey));
  const profile = useProfile(key);
  const posts = useProfilePosts(key);

  if (profile.isError) {
    const missing = isApiError(profile.error) && profile.error.status === 404;

    return (
      <Screen edges={["bottom"]}>
        <Stack.Screen options={{ title: t("profile.title") }} />
        <ErrorState
          message={missing ? t("profile.notFound") : errorText(profile.error)}
          onRetry={missing ? undefined : () => void profile.refetch()}
        />
      </Screen>
    );
  }
  const data = profile.data;

  const header = data ? (
    <View style={{ alignItems: "center", gap: space.sm, paddingBottom: space.lg }}>
      <Avatar name={data.name} uri={data.avatarUrl} size={88} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Txt size={22} weight="700">
          {data.name}
        </Txt>
        {data.verified ? (
          <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
        ) : null}
      </View>
      <Txt tone="muted" size={13}>
        {t(`profile.role.${data.role}`)}
        {data.friendCount !== null ? ` · ${t("profile.friends", { count: data.friendCount })}` : ""}
      </Txt>
      <Txt tone={data.bio ? "default" : "muted"} style={{ textAlign: "center" }}>
        {data.bio || t("profile.noBio")}
      </Txt>
      {data.stats ? (
        <View style={{ flexDirection: "row", alignSelf: "stretch", paddingTop: space.sm }}>
          <Stat value={data.stats.workouts} label={t("profile.workouts")} />
          <Stat value={data.stats.streak} label={t("profile.streak")} />
          <Stat value={data.stats.totalSets} label={t("profile.sets")} />
        </View>
      ) : null}
    </View>
  ) : (
    <View style={{ alignItems: "center", gap: space.sm, paddingBottom: space.lg }}>
      <Skeleton width={88} height={88} round />
      <Skeleton width={140} height={18} />
      <Skeleton width={200} height={12} />
    </View>
  );

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: data?.name ?? t("profile.title") }} />
      <PostList
        header={header}
        posts={posts.posts}
        isPending={posts.isPending}
        isError={posts.isError}
        error={posts.error}
        isRefetching={posts.isRefetching}
        hasNextPage={posts.hasNextPage}
        isFetchingNextPage={posts.isFetchingNextPage}
        onRefresh={() => {
          void posts.refetch();
          void profile.refetch();
        }}
        onEndReached={() => void posts.fetchNextPage()}
        emptyTitle={t("profile.postsEmpty")}
        errorText={errorText}
      />
    </Screen>
  );
};
