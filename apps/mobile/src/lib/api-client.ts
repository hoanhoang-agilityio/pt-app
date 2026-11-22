import type { z } from "zod";

import {
  API_CODES,
  ApiError,
  apiErrorFromBody,
  isSessionEndedError,
} from "./errors";

// Framework-free HTTP client of the REST API. `fetch` is injected so the whole
// thing runs under Vitest. Responses are validated with the @pt/contracts Zod
// schemas the caller passes; a response that does not match is a hard error
// (the app and the API disagree) and never reaches the UI.

export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions<S extends z.ZodType | undefined = undefined> = {
  query?: Query;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  // Validates and types the JSON answer. Without it the raw JSON is returned.
  schema?: S;
  // Sends no Authorization header (login).
  anonymous?: boolean;
};

export type ClientDeps = {
  baseUrl: string;
  getToken: () => string | null;
  // Called once when a request proves the session is over (401 session codes).
  onSessionEnded?: () => void;
  fetchImpl?: typeof fetch;
  // Sent on every request, e.g. the app version.
  headers?: Record<string, string>;
};

export const buildUrl = (baseUrl: string, path: string, query?: Query) => {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const pairs = Object.entries(query ?? {}).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined && entry[1] !== null,
  );

  if (pairs.length === 0) {
    return url;
  }
  const search = pairs
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");

  return `${url}?${search}`;
};

// An absolute URL for an API path such as "/v1/chat/photos/3"; absolute URLs
// pass through unchanged.
export const resolveApiUrl = (baseUrl: string, pathOrUrl: string) =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : buildUrl(baseUrl, pathOrUrl);

const isAbort = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  ((error as { name?: string }).name === "AbortError" ||
    (error as { name?: string }).name === "TimeoutError");

const readBody = async (response: Response) => {
  const text = await response.text().catch(() => "");

  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

export type ApiClient = ReturnType<typeof createApiClient>;

export const createApiClient = (deps: ClientDeps) => {
  const doFetch = deps.fetchImpl ?? fetch;

  const send = async (
    method: string,
    path: string,
    init: {
      query?: Query;
      body?: BodyInit | null;
      contentType?: string;
      idempotencyKey?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
      anonymous?: boolean;
    },
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...deps.headers,
    };
    const token = init.anonymous ? null : deps.getToken();

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (init.contentType) {
      headers["content-type"] = init.contentType;
    }
    if (init.idempotencyKey) {
      headers["idempotency-key"] = init.idempotencyKey;
    }
    const controller = new AbortController();
    const timeoutMs = init.timeoutMs ?? API_TIMEOUT_MS;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();

    init.signal?.addEventListener("abort", onAbort);
    try {
      const response = await doFetch(buildUrl(deps.baseUrl, path, init.query), {
        method,
        headers,
        body: init.body ?? undefined,
        signal: controller.signal,
      });

      if (!response.ok && response.status !== 304) {
        const error = apiErrorFromBody(response.status, await readBody(response), {
          method,
          path,
        });

        if (!init.anonymous && isSessionEndedError(error)) {
          deps.onSessionEnded?.();
        }
        throw error;
      }
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const wasTimeout = isAbort(error) && timedOut;

      throw new ApiError({
        kind: wasTimeout ? "timeout" : "network",
        status: 0,
        code: wasTimeout ? API_CODES.TIMEOUT : API_CODES.UNREACHABLE,
        message: wasTimeout
          ? `API did not answer within ${timeoutMs} ms`
          : "API is not reachable",
        method,
        path,
      });
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", onAbort);
    }
  };

  const parse = async <S extends z.ZodType | undefined>(
    response: Response,
    schema: S,
    context: { method: string; path: string },
  ): Promise<S extends z.ZodType ? z.infer<S> : unknown> => {
    if (response.status === 204 || response.status === 304) {
      return undefined as never;
    }
    const json = (await readBody(response)) as unknown;

    if (!schema) {
      return json as never;
    }
    const parsed = schema.safeParse(json);

    if (!parsed.success) {
      throw new ApiError({
        status: response.status,
        code: "RESPONSE_INVALID",
        message: `Unexpected answer from ${context.method} ${context.path}`,
        ...context,
      });
    }
    return parsed.data as never;
  };

  const request = async <S extends z.ZodType | undefined = undefined>(
    method: string,
    path: string,
    options: RequestOptions<S> = {},
  ) => {
    const hasBody = options.body !== undefined;
    const response = await send(method, path, {
      query: options.query,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      contentType: hasBody ? "application/json" : undefined,
      idempotencyKey: options.idempotencyKey,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      anonymous: options.anonymous,
    });

    return parse(response, options.schema as S, { method, path });
  };

  // Raw image bytes as the body (photos, stickers); the API sniffs the type.
  const upload = async <S extends z.ZodType | undefined = undefined>(
    path: string,
    body: Blob | ArrayBuffer | Uint8Array,
    contentType: string,
    options: Pick<
      RequestOptions<S>,
      "schema" | "idempotencyKey" | "signal" | "query"
    > = {},
  ) => {
    const response = await send("POST", path, {
      body: body as BodyInit,
      contentType,
      idempotencyKey: options.idempotencyKey,
      signal: options.signal,
      query: options.query,
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });

    return parse(response, options.schema as S, { method: "POST", path });
  };

  return {
    get: <S extends z.ZodType | undefined = undefined>(
      path: string,
      options?: RequestOptions<S>,
    ) => request("GET", path, options),
    post: <S extends z.ZodType | undefined = undefined>(
      path: string,
      options?: RequestOptions<S>,
    ) => request("POST", path, options),
    put: <S extends z.ZodType | undefined = undefined>(
      path: string,
      options?: RequestOptions<S>,
    ) => request("PUT", path, options),
    patch: <S extends z.ZodType | undefined = undefined>(
      path: string,
      options?: RequestOptions<S>,
    ) => request("PATCH", path, options),
    delete: <S extends z.ZodType | undefined = undefined>(
      path: string,
      options?: RequestOptions<S>,
    ) => request("DELETE", path, options),
    upload,
    url: (pathOrUrl: string) => resolveApiUrl(deps.baseUrl, pathOrUrl),
  };
};
