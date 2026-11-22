import type { SocialPostResponse } from "@pt/contracts";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

const POST_KEYS = new Set(["feed", "profile-posts", "post"]);

type PostPage = { items: SocialPostResponse[]; nextCursor: string | null };

const isInfinite = (data: unknown): data is InfiniteData<PostPage> =>
  typeof data === "object" &&
  data !== null &&
  Array.isArray((data as { pages?: unknown }).pages);

const isPost = (data: unknown): data is SocialPostResponse =>
  typeof data === "object" &&
  data !== null &&
  typeof (data as { caption?: unknown }).caption === "string" &&
  typeof (data as { id?: unknown }).id === "number";

// Applies `change` to post `id` in every cached feed, profile list and post
// page, so a reaction or an edit shows everywhere at once. `null` removes it.
export const updatePostEverywhere = (
  queryClient: QueryClient,
  id: number,
  change: (post: SocialPostResponse) => SocialPostResponse | null,
) => {
  for (const [key, data] of queryClient.getQueriesData({ queryKey: ["social"] })) {
    // Only post lists and post pages: comments and reactors also live under
    // "social" and their ids are not post ids.
    if (!POST_KEYS.has(String(key[1]))) {
      continue;
    }
    if (isInfinite(data)) {
      queryClient.setQueryData<InfiniteData<PostPage>>(key, {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.flatMap((post) => {
            if (post.id !== id) {
              return [post];
            }
            const next = change(post);

            return next ? [next] : [];
          }),
        })),
      });
    } else if (isPost(data) && data.id === id) {
      const next = change(data);

      if (next) {
        queryClient.setQueryData(key, next);
      } else {
        queryClient.removeQueries({ queryKey: key });
      }
    }
  }
};
