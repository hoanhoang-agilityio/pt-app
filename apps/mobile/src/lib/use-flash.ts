import { useCallback, useEffect, useRef, useState } from "react";

// A short-lived inline confirmation ("Đã lưu"); the app has no toast layer.
export const useFlash = (ms = 2500) => {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );
  const flash = useCallback(
    (text: string) => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );

  return [message, flash] as const;
};
