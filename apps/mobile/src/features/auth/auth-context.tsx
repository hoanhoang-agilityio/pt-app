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
import { AppState } from "react-native";

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
  onBeforeSignOut: (handler: SignOutHandler) => () => void;
};

// `forced`: the server already ended the session (401 or authRevoked).
export type SignOutHandler = (info: { forced: boolean }) => Promise<void>;

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
  const beforeSignOut = useRef(new Set<SignOutHandler>());

  const applyLocale = useCallback(async (me: MeResponse) => {
    const stored = await readLocale();
    const chosen = isAppLocale(me.actor.locale)
      ? me.actor.locale
      : pickLocale(stored, deviceLanguage());

    await setAppLocale(chosen);
  }, []);

  const clearSession = useCallback(
    async (sessionEnded: boolean) => {
      if (sessionEnded) {
        // Forced sign-out: run the cleanups best effort, never block on them.
        for (const handler of beforeSignOut.current) {
          void handler({ forced: true }).catch(() => undefined);
        }
      }
      setSessionToken(null);
      await writeToken(null);
      queryClient.clear();
      setState({ status: "signedOut", sessionEnded });
    },
    [queryClient],
  );

  // Rotates the token when the session is close to expiring; keeps the
  // current one if the refresh fails.
  const refreshIfNeeded = useCallback(async (me: MeResponse) => {
    if (
      !shouldRefreshSession({
        role: me.actor.kind === "admin" ? "admin" : "user",
        expiresAt: me.session.expiresAt,
      })
    ) {
      return me;
    }
    try {
      const fresh = await refreshSession();

      setSessionToken(fresh.token);
      await writeToken(fresh.token);
      return fresh;
    } catch {
      return me;
    }
  }, []);

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
      const me = await refreshIfNeeded(await fetchMe());

      await applyLocale(me);
      setState({ status: "signedIn", me });
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        await clearSession(true);
        return;
      }
      setState({ status: "unreachable" });
    }
  }, [applyLocale, clearSession, refreshIfNeeded]);

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

      // Locale first: nothing is stored yet if it throws. Later steps roll the
      // token back so a half finished sign-in never leaves a stored session.
      await applyLocale(result);
      try {
        setSessionToken(result.token);
        await writeToken(result.token);
        queryClient.clear();
        setState({ status: "signedIn", me: result });
      } catch (error) {
        setSessionToken(null);
        await writeToken(null);
        throw error;
      }
    },
    [applyLocale, queryClient],
  );

  // Coming back to the foreground: rotate a session that is about to expire.
  const stateRef = useRef(state);
  const refreshing = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const current = stateRef.current;

      if (next !== "active" || current.status !== "signedIn" || refreshing.current) {
        return;
      }
      refreshing.current = true;
      void refreshIfNeeded(current.me)
        .then((me) => {
          if (me !== current.me) {
            setState((latest) => (latest.status === "signedIn" ? { status: "signedIn", me } : latest));
          }
        })
        .finally(() => {
          refreshing.current = false;
        });
    });

    return () => subscription.remove();
  }, [refreshIfNeeded]);

  const signOut = useCallback(async () => {
    for (const handler of beforeSignOut.current) {
      try {
        await handler({ forced: false });
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

  const onBeforeSignOut = useCallback((handler: SignOutHandler) => {
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
