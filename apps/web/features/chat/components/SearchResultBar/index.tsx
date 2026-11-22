"use client";

import clsx from "clsx";
import { ChevronDown, ChevronLeft, ChevronUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ICON_BUTTON } from "@/constants/styles";
import {
  type ChatPaths,
  jumpHref,
  searchHref,
} from "@/features/chat/utils/chat-links";
import { appendIds, resultNav } from "@/features/chat/utils/search-result-nav";
import { isSearchPage } from "@/features/chat/utils/search-rules";

export interface SearchContext {
  // The searched text (`?q=` of the chat page).
  query: string;
  // The route that answers the search (`?q=<text>&before=<cursor>`).
  endpoint: string;
  paths: ChatPaths;
}

interface SearchResultBarProps {
  context: SearchContext;
  // The message the chat is opened at.
  currentId: number | null;
}

interface Loaded {
  ids: number[];
  nextCursor: number | null;
}

// Result ids already fetched, per endpoint and query. Moving to another
// result remounts the thread (new message window), so the bar starts from
// here instead of searching again.
const cache = new Map<string, Loaded>();
// Pages fetched to find an opened message that is not on the first page.
const MAX_FIND_PAGES = 10;

const cacheKey = ({ endpoint, query }: SearchContext) =>
  `${endpoint}\n${query}`;

const fetchIds = async (
  { endpoint, query }: SearchContext,
  before?: number,
): Promise<Loaded | null> => {
  const params = new URLSearchParams({ q: query });

  if (before !== undefined) {
    params.set("before", String(before));
  }
  const response = await fetch(`${endpoint}?${params}`, { cache: "no-store" });
  const data: unknown = response.ok ? await response.json() : null;

  return isSearchPage(data)
    ? {
        ids: data.results.map((result) => result.messageId),
        nextCursor: data.nextCursor,
      }
    : null;
};

// The slim bar at the top of a chat opened from a search result: back to the
// result list, "n/total" with up (older) and down (newer) arrows, and close.
export const SearchResultBar = ({
  context,
  currentId,
}: SearchResultBarProps) => {
  const t = useTranslations("chat.searchResultBar");
  const router = useRouter();
  const key = cacheKey(context);
  const [loaded, setLoaded] = useState<Loaded | null>(
    () => cache.get(key) ?? null,
  );
  const [hasFailed, setHasFailed] = useState(false);
  const findPages = useRef(0);
  // A page request is out; never two at once.
  const isLoading = useRef(false);

  const store = (next: Loaded) => {
    cache.set(key, next);
    setLoaded(next);
  };

  // First page, or the page after the loaded ones; `null` when it failed.
  const loadPage = async (from: Loaded | null) => {
    if (isLoading.current) {
      return null;
    }
    isLoading.current = true;
    try {
      const page = await fetchIds(context, from?.nextCursor ?? undefined);

      if (page === null) {
        isLoading.current = false;
        setHasFailed(true);
        return null;
      }
      const next = {
        ids: appendIds(from?.ids ?? [], page.ids),
        nextCursor: page.nextCursor,
      };

      isLoading.current = false;
      store(next);
      return next;
    } catch {
      isLoading.current = false;
      setHasFailed(true);
      return null;
    }
  };

  const nav = resultNav(
    loaded?.ids ?? [],
    currentId,
    (loaded?.nextCursor ?? null) !== null,
  );

  // Fetch the first page, and keep paging until the opened message shows up.
  useEffect(() => {
    if (hasFailed) {
      return;
    }
    const wantsMore =
      loaded === null ||
      (nav.position === null &&
        loaded.nextCursor !== null &&
        findPages.current < MAX_FIND_PAGES);

    if (!wantsMore) {
      return;
    }
    // Off the effect body: the page request sets state when it answers.
    const timer = setTimeout(() => {
      if (loaded !== null) {
        findPages.current += 1;
      }
      void loadPage(loaded);
    }, 0);

    return () => clearTimeout(timer);
    // loadPage closes over the current `loaded`; the state listed drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, hasFailed, nav.position]);

  const goTo = (id: number) =>
    router.replace(jumpHref(context.paths.chat, id, context.query), {
      scroll: false,
    });

  const goOlder = async () => {
    if (nav.olderId !== null) {
      goTo(nav.olderId);
      return;
    }
    if (!nav.needsOlderPage || loaded === null) {
      return;
    }
    const next = await loadPage(loaded);
    const first = next?.ids[loaded.ids.length];

    if (first !== undefined) {
      goTo(first);
    }
  };

  // Closing keeps the message in view (`?m=` stays, so the thread is not
  // remounted onto the newest messages); only the result bar goes.
  const close = () =>
    router.replace(
      currentId === null
        ? context.paths.chat
        : jumpHref(context.paths.chat, currentId),
      { scroll: false },
    );

  const canOlder = nav.olderId !== null || nav.needsOlderPage;

  return (
    <div
      data-search-result-bar
      className="flex min-h-11 shrink-0 items-center gap-1 border-b border-line bg-surface px-2"
    >
      <Link
        href={searchHref(context.paths.search, context.query)}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-xl py-2 text-sm font-medium text-fg transition active:bg-line"
        aria-label={t("backToResults")}
      >
        <ChevronLeft className="size-5 shrink-0 text-muted" aria-hidden />
        <span className="truncate">
          {t("resultsFor", { query: context.query })}
        </span>
      </Link>
      {nav.position !== null && (
        <span
          className="shrink-0 px-1 text-xs text-muted tabular-nums"
          aria-live="polite"
        >
          {nav.position}/{nav.total}
          {loaded?.nextCursor != null && "+"}
        </span>
      )}
      <button
        type="button"
        className={clsx(ICON_BUTTON, "size-9")}
        onClick={() => void goOlder()}
        disabled={!canOlder}
        aria-label={t("older")}
      >
        <ChevronUp className="size-5" />
      </button>
      <button
        type="button"
        className={clsx(ICON_BUTTON, "size-9")}
        onClick={() => nav.newerId !== null && goTo(nav.newerId)}
        disabled={nav.newerId === null}
        aria-label={t("newer")}
      >
        <ChevronDown className="size-5" />
      </button>
      <button
        type="button"
        className={clsx(ICON_BUTTON, "size-9")}
        onClick={close}
        aria-label={t("close")}
      >
        <X className="size-5" />
      </button>
    </div>
  );
};
