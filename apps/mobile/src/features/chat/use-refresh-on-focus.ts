import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

// Runs `refresh` when the screen regains focus after another screen (chat
// info, search...) was on top, not on the first focus.
export const useRefreshOnFocus = (refresh: () => void) => {
  const first = useRef(true);
  const latest = useRef(refresh);

  useEffect(() => {
    latest.current = refresh;
  });
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      latest.current();
    }, []),
  );
};
