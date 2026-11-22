// Error type and mapping for every API call. Pure (no React Native imports) so
// it is unit-testable. Mirrors apps/web/services/api/errors.ts.

export type ApiErrorKind = "http" | "timeout" | "network";

export type ApiErrorInit = {
  kind?: ApiErrorKind;
  // HTTP status; 0 when no response arrived (timeout, network).
  status: number;
  // Stable API code, e.g. "INVALID_CREDENTIALS", "ADMIN_LOCKED".
  code: string;
  message: string;
  // Id of the API log line that holds the real cause.
  ref?: string;
  details?: Record<string, string | number | boolean>;
  method?: string;
  path?: string;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: string;
  readonly ref?: string;
  readonly details?: Record<string, string | number | boolean>;
  readonly method?: string;
  readonly path?: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind ?? "http";
    this.status = init.status;
    this.code = init.code;
    this.ref = init.ref;
    this.details = init.details;
    this.method = init.method;
    this.path = init.path;
  }

  // A 4xx: the API chose `message` for the user, it is safe to show.
  get isClientError() {
    return this.kind === "http" && this.status >= 400 && this.status < 500;
  }

  get fieldErrors() {
    return this.code === API_CODES.VALIDATION_FAILED
      ? parseValidationMessage(this.message)
      : undefined;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export const API_CODES = {
  SESSION_INVALID: "SESSION_INVALID",
  UNAUTHORIZED: "UNAUTHORIZED",
  ADMIN_LOCKED: "ADMIN_LOCKED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNREACHABLE: "API_UNREACHABLE",
  TIMEOUT: "API_TIMEOUT",
} as const;

// The 401 codes that mean "this session is over" (not wrong credentials).
export const isSessionEndedError = (error: unknown) =>
  isApiError(error) &&
  error.status === 401 &&
  (error.code === API_CODES.SESSION_INVALID ||
    error.code === API_CODES.UNAUTHORIZED);

export const isAdminLockedError = (error: unknown) =>
  isApiError(error) &&
  error.status === 403 &&
  error.code === API_CODES.ADMIN_LOCKED;

const VALIDATION_PART = /^([A-Za-z_][\w.[\]-]*): (.+)$/;

// "path: text; path.2: text" -> { path: "text" } (first path segment).
export const parseValidationMessage = (message: string) => {
  const fieldErrors: Partial<Record<string, string>> = {};

  for (const part of message.split("; ")) {
    const match = VALIDATION_PART.exec(part);

    if (match) {
      const field = match[1].split(/[.[]/)[0];

      fieldErrors[field] ??= match[2];
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
};

// Builds an ApiError from a non-2xx body `{ code, message, ref, details }`.
// Anything else becomes a generic error for the status.
export const apiErrorFromBody = (
  status: number,
  body: unknown,
  context: { method?: string; path?: string } = {},
) => {
  const fields =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const details =
    typeof fields.details === "object" &&
    fields.details !== null &&
    !Array.isArray(fields.details)
      ? (fields.details as ApiErrorInit["details"])
      : undefined;

  return new ApiError({
    status,
    code: typeof fields.code === "string" ? fields.code : `HTTP_${status}`,
    message:
      typeof fields.message === "string" && fields.message
        ? fields.message
        : `HTTP ${status}`,
    ref: typeof fields.ref === "string" ? fields.ref : undefined,
    details,
    ...context,
  });
};

// Text for an error in the UI: 4xx shows the API's own message, anything else a
// generic one (with the reference when the API sent it).
export const describeError = (
  error: unknown,
  generic: string,
  withRef: (message: string, ref: string) => string = (message, ref) =>
    `${message} (${ref})`,
) => {
  if (isApiError(error)) {
    if (error.isClientError) {
      return error.ref ? withRef(error.message, error.ref) : error.message;
    }
    return error.ref ? withRef(generic, error.ref) : generic;
  }
  return generic;
};
