"use client";

import { useEffect, useState } from "react";

// `value`, but only after it stayed the same for `delayMs`.
export const useDebouncedValue = <T>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
};
