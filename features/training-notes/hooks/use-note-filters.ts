"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ROUTES } from "@/constants/routes";
import type { TrainingNoteRange } from "@/features/training-notes/types/training-note";

const SEARCH_DELAY_MS = 300;

export const buildNotesHref = (range: TrainingNoteRange, query: string) => {
  const params = new URLSearchParams();

  if (range !== "all") {
    params.set("range", range);
  }
  if (query.trim() !== "") {
    params.set("q", query.trim());
  }
  const search = params.toString();

  return search ? `${ROUTES.ADMIN_NOTES}?${search}` : ROUTES.ADMIN_NOTES;
};

// The search text lives in the URL (?q=) so the server filters the list; the
// field keeps its own state and updates the URL once typing pauses.
export const useNoteFilters = (
  range: TrainingNoteRange,
  initialQuery: string,
) => {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (query.trim() === initialQuery.trim()) {
      return;
    }
    const timer = setTimeout(
      () => router.replace(buildNotesHref(range, query), { scroll: false }),
      SEARCH_DELAY_MS,
    );

    return () => clearTimeout(timer);
  }, [query, initialQuery, range, router]);

  return { query, setQuery };
};
