import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchFoods } from "./api";
import { ak } from "./keys";

// Food library search with "load more" (cursor paging).
export const useFoodSearch = (q: string, group: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: ak.foods(q, group),
    queryFn: ({ pageParam }) =>
      fetchFoods({ q, group: group || undefined, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
