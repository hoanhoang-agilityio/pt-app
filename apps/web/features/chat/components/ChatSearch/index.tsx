"use client";

import clsx from "clsx";
import { ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/common/Input";
import { Spinner } from "@/components/common/Spinner";
import { ICON_BUTTON, PAGE_CONTAINER } from "@/constants/styles";
import { type ChatPaths, jumpHref } from "@/features/chat/utils/chat-links";
import {
  clearSearchRestore,
  extraPagesToLoad,
  readSearchRestore,
  saveSearchRestore,
} from "@/features/chat/utils/search-restore";
import {
  formatResultTime,
  isSearchableQuery,
  isSearchPage,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  type SearchResult,
  searchSenderLabel,
} from "@/features/chat/utils/search-rules";

interface ChatSearchProps {
  viewer:
    | { role: "user" }
    | { role: "admin"; adminId: number; peerName: string | null };
  // Route of the search (`?q=<text>&before=<cursor>`).
  endpoint: string;
  paths: ChatPaths;
  nicknames: Readonly<Record<string, string>>;
  // `?q=` of the page: the search the URL already holds (back from a chat).
  initialQuery?: string;
}

const DEBOUNCE_MS = 300;
const RESTORE_HIGHLIGHT_MS = 1800;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "done";
      query: string;
      results: SearchResult[];
      nextCursor: number | null;
      // Result pages loaded so far; saved before a result is opened.
      pages: number;
    };

// Search inside the open conversation (KAN-160, S1 and S2). Two characters or
// more; accents do not matter. Each result shows who wrote it, the text
// around the match with the match in bold, and when; a tap opens the chat at
// that message.
export const ChatSearch = ({
  viewer,
  endpoint,
  paths,
  nicknames,
  initialQuery = "",
}: ChatSearchProps) => {
  const router = useRouter();
  const [text, setText] = useState(initialQuery);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // The newest request wins; an older answer is dropped.
  const requestId = useRef(0);
  const [now] = useState(() => Date.now());
  // What to bring back after the first load: set once from sessionStorage when
  // the page opens with a query, consumed when the list is scrolled back.
  const restore = useRef<ReturnType<typeof readSearchRestore>>(null);
  const hasInitialRun = useRef(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = text.trim();

    requestId.current += 1;
    if (!isSearchableQuery(query)) {
      // Nothing to look up; the view below shows the hint.
      return;
    }
    const id = requestId.current;
    const controller = new AbortController();
    const isFirstRun = !hasInitialRun.current;

    hasInitialRun.current = true;
    if (isFirstRun && query === initialQuery.trim()) {
      restore.current = readSearchRestore(endpoint, query);
    }
    const pending = restore.current;
    // The first run of a restored page does not wait for typing to settle.
    const timer = setTimeout(
      async () => {
        setState({ kind: "loading" });
        try {
          const fetchPage = async (before?: number) => {
            const params = new URLSearchParams({ q: query });

            if (before !== undefined) {
              params.set("before", String(before));
            }
            const response = await fetch(`${endpoint}?${params}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            const data: unknown = response.ok ? await response.json() : null;

            return isSearchPage(data) ? data : null;
          };
          let page = await fetchPage();
          let results = page?.results ?? [];
          let pages = 1;

          // Reload as many pages as were open when a result was tapped.
          while (page !== null && pending !== null) {
            if (extraPagesToLoad(pending, pages, page.nextCursor) === 0) {
              break;
            }
            const next = await fetchPage(page.nextCursor ?? undefined);

            if (id !== requestId.current) {
              return;
            }
            if (next === null) {
              break;
            }
            results = [
              ...results,
              ...next.results.filter(
                (result) =>
                  !results.some(
                    (known) => known.messageId === result.messageId,
                  ),
              ),
            ];
            page = { results, nextCursor: next.nextCursor };
            pages += 1;
          }
          if (id !== requestId.current) {
            return;
          }
          setState(
            page
              ? {
                  kind: "done",
                  query,
                  results,
                  nextCursor: page.nextCursor,
                  pages,
                }
              : { kind: "error" },
          );
        } catch {
          if (id === requestId.current) {
            setState({ kind: "error" });
          }
        }
      },
      isFirstRun ? 0 : DEBOUNCE_MS,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `initialQuery` only matters on the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, endpoint]);

  // Keep the query in the URL, so a back from the chat reopens this search.
  useEffect(() => {
    const query = text.trim();
    const timer = setTimeout(() => {
      router.replace(
        isSearchableQuery(query)
          ? `${paths.search}?${new URLSearchParams({ q: query })}`
          : paths.search,
        { scroll: false },
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, paths.search, router]);

  // After a restore: bring the tapped result into view and flash it.
  useEffect(() => {
    const pending = restore.current;

    if (pending === null || state.kind !== "done") {
      return;
    }
    restore.current = null;
    clearSearchRestore(endpoint, state.query);
    const node = document.querySelector(
      `[data-search-result="${pending.messageId}"]`,
    );

    if (!node) {
      return;
    }
    node.scrollIntoView({ block: "center", behavior: "auto" });
    setHighlightId(pending.messageId);
    highlightTimer.current = setTimeout(() => {
      highlightTimer.current = null;
      setHighlightId(null);
    }, RESTORE_HIGHLIGHT_MS);
  }, [state, endpoint]);

  useEffect(
    () => () => {
      if (highlightTimer.current !== null) {
        clearTimeout(highlightTimer.current);
      }
    },
    [],
  );

  const loadMore = async () => {
    if (state.kind !== "done" || state.nextCursor === null || isLoadingMore) {
      return;
    }
    const { query, nextCursor } = state;
    const id = requestId.current;

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `${endpoint}?${new URLSearchParams({ q: query, before: String(nextCursor) })}`,
        { cache: "no-store" },
      );
      const data: unknown = response.ok ? await response.json() : null;

      if (id !== requestId.current || !isSearchPage(data)) {
        return;
      }
      setState({
        kind: "done",
        query,
        results: [
          ...state.results,
          ...data.results.filter(
            (result) =>
              !state.results.some(
                (known) => known.messageId === result.messageId,
              ),
          ),
        ],
        nextCursor: data.nextCursor,
        pages: state.pages + 1,
      });
    } catch {
      // The button stays; the user can tap again.
    } finally {
      setIsLoadingMore(false);
    }
  };

  const locale = useLocale();

  const t = useTranslations("chat.chatSearch");
  const query = text.trim();
  const isSearchable = isSearchableQuery(query);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)]">
        <div
          className={clsx(PAGE_CONTAINER, "flex min-h-14 items-center gap-1")}
        >
          <Link
            href={paths.info}
            className={clsx(ICON_BUTTON, "-ml-3")}
            aria-label={t("back")}
          >
            <ChevronLeft className="size-6" />
          </Link>
          <Input
            type="search"
            clearable
            leadingIcon={<Search className="size-5" aria-hidden />}
            wrapperClassName="min-w-0 flex-1 py-2"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={SEARCH_MAX_LENGTH}
            placeholder={t("placeholder")}
            aria-label={t("inputLabel")}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus
            className="min-h-11"
          />
        </div>
      </header>
      <main data-chat-search className={clsx(PAGE_CONTAINER, "pt-2 pb-12")}>
        {!isSearchable && (
          <p className="px-6 py-16 text-center text-sm text-muted">
            {t("minLength", { min: SEARCH_MIN_LENGTH })}
          </p>
        )}
        {isSearchable && state.kind === "loading" && (
          <p
            role="status"
            className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted"
          >
            <Spinner size="md" />
            {t("searching")}
          </p>
        )}
        {isSearchable && state.kind === "error" && (
          <p
            role="alert"
            className="px-6 py-16 text-center text-sm text-danger"
          >
            {t("failed")}
          </p>
        )}
        {isSearchable &&
          state.kind === "done" &&
          state.query === query &&
          (state.results.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-muted">
              {t("empty")}
            </p>
          ) : (
            <>
              <ul data-search-results className="divide-y divide-line">
                {state.results.map((result) => (
                  <li key={result.messageId}>
                    <Link
                      href={jumpHref(paths.chat, result.messageId, state.query)}
                      data-search-result={result.messageId}
                      onClick={() =>
                        saveSearchRestore(endpoint, state.query, {
                          pages: state.pages,
                          messageId: result.messageId,
                        })
                      }
                      className={clsx(
                        "block rounded-xl px-2 py-3 transition active:bg-line",
                        highlightId === result.messageId && "bg-line",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-fg">
                          {searchSenderLabel(result, viewer, nicknames, locale)}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {formatResultTime(result.createdAt, now, locale)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm break-words text-muted">
                        {result.snippet.before}
                        <strong className="font-bold text-fg">
                          {result.snippet.match}
                        </strong>
                        {result.snippet.after}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {state.nextCursor !== null && (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={isLoadingMore}
                    aria-busy={isLoadingMore}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition active:bg-line disabled:opacity-50"
                  >
                    {isLoadingMore && <Spinner size="sm" />}
                    {isLoadingMore ? t("searching") : t("loadMore")}
                  </button>
                </div>
              )}
            </>
          ))}
      </main>
    </>
  );
};
