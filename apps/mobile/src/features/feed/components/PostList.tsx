import type { SocialPostResponse } from "@pt/contracts";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

import { PostCard } from "./PostCard";

export const PostSkeleton = () => {
  const theme = useTheme();

  return (
    <View
      style={[styles.skeleton, { backgroundColor: theme.surface, borderColor: theme.line }]}
    >
      <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <Skeleton width={40} height={40} round />
        <View style={{ gap: 6 }}>
          <Skeleton width={120} height={12} />
          <Skeleton width={80} height={10} />
        </View>
      </View>
      <Skeleton height={12} />
      <Skeleton width="70%" height={12} />
      <Skeleton height={180} />
    </View>
  );
};

// A feed or profile list: skeletons while loading, an empty and an error
// state, pull to refresh and infinite scroll.
export const PostList = ({
  posts,
  isPending,
  isError,
  error,
  isRefetching,
  hasNextPage,
  isFetchingNextPage,
  onRefresh,
  onEndReached,
  header,
  emptyTitle,
  emptyHint,
  errorText,
}: {
  posts: SocialPostResponse[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isRefetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  header?: ReactElement | null;
  emptyTitle: string;
  emptyHint?: string;
  errorText: (error: unknown) => string;
}) => {
  const { t } = useTranslation();

  return (
    <FlatList
      data={isPending ? [] : posts}
      keyExtractor={(post) => String(post.id)}
      renderItem={({ item }) => <PostCard post={item} />}
      ListHeaderComponent={header ?? undefined}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      refreshControl={<RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={onRefresh} />}
      onEndReachedThreshold={0.6}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          onEndReached();
        }
      }}
      ListEmptyComponent={
        isPending ? (
          <View style={{ gap: space.md }}>
            <PostSkeleton />
            <PostSkeleton />
          </View>
        ) : isError ? (
          <ErrorState message={errorText(error)} onRetry={onRefresh} />
        ) : (
          <EmptyState icon="newspaper-outline" title={emptyTitle} hint={emptyHint} />
        )
      }
      ListFooterComponent={isFetchingNextPage ? <Spinner /> : undefined}
      accessibilityLabel={t("feed.title")}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: space.lg, flexGrow: 1 },
  skeleton: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
