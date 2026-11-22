import { useCallback, useRef, useState } from "react";

import { photoSlots } from "./image-plan";
import { type PickedPhoto, type PreparedPhoto, preparePhoto } from "./photos";

// Photos of a composer: each is resized, then uploaded (a few at a time); a
// failed one can be retried or removed. The caller reads `ids` when sending.

export type PhotoItem = {
  key: string;
  previewUri: string;
  status: "uploading" | "done" | "error";
  id: number | null;
  prepared: PreparedPhoto | null;
  picked: PickedPhoto;
  error: unknown;
};

let counter = 0;

export const usePhotoUploads = ({
  max,
  concurrency,
  upload,
}: {
  max: number;
  concurrency: number;
  upload: (photo: PreparedPhoto) => Promise<number>;
}) => {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const itemsRef = useRef<PhotoItem[]>([]);
  const queue = useRef<string[]>([]);
  const running = useRef(0);

  const commit = useCallback((next: PhotoItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (key: string, change: Partial<PhotoItem>) => {
      commit(itemsRef.current.map((item) => (item.key === key ? { ...item, ...change } : item)));
    },
    [commit],
  );

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const pump = useCallback(() => {
    while (running.current < concurrency && queue.current.length > 0) {
      const key = queue.current.shift() as string;
      const item = itemsRef.current.find((entry) => entry.key === key);

      if (!item) {
        continue;
      }
      running.current += 1;
      void (async () => {
        try {
          const prepared = item.prepared ?? (await preparePhoto(item.picked));
          const id = await upload(prepared);

          patch(key, { status: "done", id, prepared, error: null });
        } catch (error) {
          patch(key, { status: "error", error });
        } finally {
          running.current -= 1;
          pump();
        }
      })();
    }
  }, [concurrency, patch, upload]);

  // Returns how many picked photos did not fit.
  const add = useCallback(
    (picked: PickedPhoto[]) => {
      const { accept, dropped } = photoSlots(itemsRef.current.length, picked.length, max);
      const fresh = picked.slice(0, accept).map<PhotoItem>((photo) => {
        counter += 1;
        return {
          key: `p${counter}`,
          previewUri: photo.uri,
          status: "uploading",
          id: null,
          prepared: null,
          picked: photo,
          error: null,
        };
      });

      commit([...itemsRef.current, ...fresh]);
      queue.current.push(...fresh.map((item) => item.key));
      pump();
      return dropped;
    },
    [commit, max, pump],
  );

  const retry = useCallback(
    (key: string) => {
      patch(key, { status: "uploading", error: null });
      queue.current.push(key);
      pump();
    },
    [patch, pump],
  );

  const remove = useCallback(
    (key: string) => {
      queue.current = queue.current.filter((entry) => entry !== key);
      commit(itemsRef.current.filter((item) => item.key !== key));
    },
    [commit],
  );

  const reset = useCallback(() => {
    queue.current = [];
    commit([]);
  }, [commit]);

  const ids = items.flatMap((item) => (item.id === null ? [] : [item.id]));

  return {
    items,
    ids,
    add,
    retry,
    remove,
    reset,
    isUploading: items.some((item) => item.status === "uploading"),
    hasFailed: items.some((item) => item.status === "error"),
  };
};
