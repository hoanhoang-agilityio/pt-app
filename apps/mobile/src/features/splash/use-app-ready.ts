import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";

// True once the icon font is loaded (or failed: icons are not worth blocking
// the app for). The native splash stays up until this and the session
// bootstrap are both done (see app/_layout.tsx).
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const done = () => {
      if (active) {
        setReady(true);
      }
    };

    Ionicons.loadFont().then(done, done);
    return () => {
      active = false;
    };
  }, []);

  return ready;
};
