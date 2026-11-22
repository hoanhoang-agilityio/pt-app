import type { MeResponse } from "@pt/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { deviceLanguage, isAppLocale, pickLocale, setAppLocale } from "@/i18n";
import { setSessionEndedHandler, setSessionToken } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { shouldRefreshSession } from "@/lib/session-refresh";
import {
  readLocale,
  readToken,
  writeLocale,
  writeToken,
} from "@/lib/token-store";

import {
  fetchMe,
  loginAdmin,
  loginTrainee,
  logoutSession,
  refreshSession,
  saveLocale,
} from "./api";

export type AuthState =
  | { status: "loading" }
  // The API could not be reached at launch; the token is kept.
  | { status: "unreachable" }
  | { status: "signedOut"; sessionEnded: boolean }
  | { status: "signedIn"; me: MeResponse };

type AuthContextValue = {
  state: AuthState;
  signIn: (kind: "trainee" | "admin", login: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
  changeLocale: (locale: string) => Promise<void>;
  // Hooks run before the token is dropped on logout (e.g. push unregister).
  onBeforeSignOut: (handler: () => Promise<void>) => () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
};

// The signed-in person, or throws: use below the auth gate only.
export const useMe = () => {
  const { state } = useAuth();

  if (state.status !== "signedIn") {
    throw new Error("useMe needs a signed-in session");
  }
  return state.me;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const beforeSignOut = useRef(new Set<() => Promise<void>>());

  const applyLocale = useCallback(async (me: MeResponse) => {
    const stored = await readLocale();
    const chosen = isAppLocale(me.actor.locale)
      ? me.actor.locale
      : pickLocale(stored, deviceLanguage());

    await setAppLocale(chosen);
  }, []);

  const clearSession = useCallback(
    async (sessionEnded: boolean) => {
      setSessionToken(null);
      await writeToken(null);
      queryClient.clear();
      setState({ status: "signedOut", sessionEnded });
    },
    [queryClient],
  );

  const bootstrap = useCallback(async () => {
    setState({ status: "loading" });
    const token = await readToken();

    if (!token) {
      await setAppLocale(pickLocale(await readLocale(), deviceLanguage()));
      setState({ status: "signedOut", sessionEnded: false });
      return;
    }
    setSessionToken(token);
    try {
      let me = await fetchMe();

      if (
        shouldRefreshSession({
          role: me.actor.kind === "admin" ? "admin" : "user",
          expiresAt: me.session.expiresAt,
        })
      ) {
        try {
          const fresh = await refreshSession();

          setSessionToken(fresh.token);
          await writeToken(fresh.token);
          me = fresh;
        } catch {
          // Keep the current token: it still works until it expires.
        }
      }
      await applyLocale(me);
      setState({ status: "signedIn", me });
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        await clearSession(true);
        return;
      }
      setState({ status: "unreachable" });
    }
  }, [applyLocale, clearSession]);

  useEffect(() => {
    setSessionEndedHandler(() => {
      void clearSession(true);
    });
    // Bootstrap reads the stored token and sets state once, on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void bootstrap();
    return () => setSessionEndedHandler(null);
  }, [bootstrap, clearSession]);

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (kind, login, password) => {
      const result =
        kind === "admin"
          ? await loginAdmin(login, password)
          : await loginTrainee(login, password);

      setSessionToken(result.token);
      await writeToken(result.token);
      await applyLocale(result);
      queryClient.clear();
      setState({ status: "signedIn", me: result });
    },
    [applyLocale, queryClient],
  );

  const signOut = useCallback(async () => {
    for (const handler of beforeSignOut.current) {
      try {
        await handler();
      } catch {
        // Never block a sign out on a best-effort cleanup.
      }
    }
    try {
      await logoutSession();
    } catch {
      // Already gone or offline: the token is dropped either way.
    }
    await clearSession(false);
  }, [clearSession]);

  const changeLocale = useCallback(
    async (locale: string) => {
      if (!isAppLocale(locale)) {
        return;
      }
      await setAppLocale(locale);
      await writeLocale(locale);
      await saveLocale(locale);
      setState((current) =>
        current.status === "signedIn"
          ? {
              status: "signedIn",
              me: { ...current.me, actor: { ...current.me.actor, locale } },
            }
          : current,
      );
    },
    [],
  );

  const onBeforeSignOut = useCallback((handler: () => Promise<void>) => {
    beforeSignOut.current.add(handler);
    return () => {
      beforeSignOut.current.delete(handler);
    };
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signOut, retry: () => void bootstrap(), changeLocale, onBeforeSignOut }),
    [state, signIn, signOut, bootstrap, changeLocale, onBeforeSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
