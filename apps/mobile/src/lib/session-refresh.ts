// When to rotate the session token (POST /v1/auth/refresh). The API slides a
// trainee session by itself (400 days, extended on use); an admin session is a
// fixed 7 days that only `refresh` renews. So: admins refresh once less than
// 5 days are left (at most every other day of use), trainees only when they
// have been away so long that less than 30 days remain.

const DAY_MS = 24 * 60 * 60 * 1000;

export const REFRESH_WINDOW_MS = {
  admin: 5 * DAY_MS,
  user: 30 * DAY_MS,
} as const;

export type RefreshInput = {
  role: "admin" | "user";
  expiresAt: string | Date;
  now?: Date;
};

export const shouldRefreshSession = ({
  role,
  expiresAt,
  now = new Date(),
}: RefreshInput) => {
  const expiry = new Date(expiresAt).getTime();

  if (Number.isNaN(expiry)) {
    return false;
  }
  const remaining = expiry - now.getTime();

  // Already expired: refresh cannot help, the API will answer 401.
  return remaining > 0 && remaining <= REFRESH_WINDOW_MS[role];
};

// Runs `task` once at a time: callers that arrive while it is in flight share
// its result. Used so two screens never rotate the token twice.
export const singleFlight = <T>(task: () => Promise<T>) => {
  let inFlight: Promise<T> | null = null;

  return () => {
    inFlight ??= task().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
};
