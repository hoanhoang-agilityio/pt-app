import { authTokenResponseSchema } from "@pt/contracts";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { buildUrl, createApiClient, resolveApiUrl } from "../api-client";
import {
  API_CODES,
  ApiError,
  apiErrorFromBody,
  describeError,
  isAdminLockedError,
  isSessionEndedError,
  parseValidationMessage,
} from "../errors";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const clientWith = (
  fetchImpl: typeof fetch,
  extra: Partial<Parameters<typeof createApiClient>[0]> = {},
) =>
  createApiClient({
    baseUrl: "http://api.test/",
    getToken: () => "tok",
    fetchImpl,
    ...extra,
  });

describe("buildUrl", () => {
  it("joins base and path and skips empty query values", () => {
    expect(
      buildUrl("http://api.test/", "/v1/x", { a: 1, b: undefined, c: null, d: "é f" }),
    ).toBe("http://api.test/v1/x?a=1&d=%C3%A9%20f");
  });

  it("keeps absolute urls and resolves api paths", () => {
    expect(resolveApiUrl("http://api.test", "https://media.giphy.com/a.gif")).toBe(
      "https://media.giphy.com/a.gif",
    );
    expect(resolveApiUrl("http://api.test", "/v1/chat/photos/3")).toBe(
      "http://api.test/v1/chat/photos/3",
    );
  });
});

describe("error mapping", () => {
  it("builds an ApiError from the API body", () => {
    const error = apiErrorFromBody(409, {
      code: "GROUP_FULL",
      message: "Nhóm đã đủ",
      ref: "r1",
      details: { attemptsLeft: 2 },
    });

    expect(error).toMatchObject({
      status: 409,
      code: "GROUP_FULL",
      message: "Nhóm đã đủ",
      ref: "r1",
      details: { attemptsLeft: 2 },
    });
    expect(error.isClientError).toBe(true);
  });

  it("falls back to a generic error for a body that is not the API's", () => {
    const error = apiErrorFromBody(502, "<html>");

    expect(error.code).toBe("HTTP_502");
    expect(error.message).toBe("HTTP 502");
    expect(error.isClientError).toBe(false);
  });

  it("parses validation messages into field errors", () => {
    expect(parseValidationMessage("email: bad; password.0: short; nonsense")).toEqual({
      email: "bad",
      password: "short",
    });
    expect(parseValidationMessage("just text")).toBeUndefined();
  });

  it("recognises ended sessions and the admin lock", () => {
    expect(isSessionEndedError(apiErrorFromBody(401, { code: "SESSION_INVALID" }))).toBe(true);
    expect(isSessionEndedError(apiErrorFromBody(401, { code: "INVALID_CREDENTIALS" }))).toBe(false);
    expect(isAdminLockedError(apiErrorFromBody(403, { code: "ADMIN_LOCKED" }))).toBe(true);
  });

  it("shows 4xx messages as is and 5xx as the generic text, both with the ref", () => {
    const refd = (m: string, r: string) => `${m} [${r}]`;

    expect(
      describeError(apiErrorFromBody(400, { message: "Sai", ref: "a" }), "generic", refd),
    ).toBe("Sai [a]");
    expect(
      describeError(apiErrorFromBody(500, { message: "boom", ref: "b" }), "generic", refd),
    ).toBe("generic [b]");
    expect(describeError(new Error("x"), "generic")).toBe("generic");
  });
});

describe("createApiClient", () => {
  it("sends the bearer token, json body and idempotency key", async () => {
    const fetchImpl = vi.fn(async () => json(200, { ok: true }));
    const client = clientWith(fetchImpl as unknown as typeof fetch);

    await client.post("/v1/social/posts", {
      body: { caption: "hi" },
      idempotencyKey: "k1",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe("http://api.test/v1/social/posts");
    expect(headers.authorization).toBe("Bearer tok");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["idempotency-key"]).toBe("k1");
    expect(init.body).toBe('{"caption":"hi"}');
  });

  it("sends no token for anonymous calls", async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));

    await clientWith(fetchImpl as unknown as typeof fetch).post("/v1/auth/login", {
      anonymous: true,
      body: {},
    });
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];

    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("validates the answer with the contract schema", async () => {
    const client = clientWith((async () => json(200, { token: 1 })) as unknown as typeof fetch);

    await expect(
      client.post("/v1/auth/login", { schema: authTokenResponseSchema, anonymous: true }),
    ).rejects.toMatchObject({ code: "RESPONSE_INVALID" });
  });

  it("returns the parsed data and undefined for 204", async () => {
    const schema = z.object({ n: z.number() });
    const ok = clientWith((async () => json(200, { n: 3 })) as unknown as typeof fetch);
    const empty = clientWith((async () => json(204)) as unknown as typeof fetch);

    expect(await ok.get("/x", { schema })).toEqual({ n: 3 });
    expect(await empty.get("/x", { schema })).toBeUndefined();
  });

  it("throws ApiError for 4xx and tells the app when the session ended", async () => {
    const onSessionEnded = vi.fn();
    const client = clientWith(
      (async () =>
        json(401, { code: API_CODES.SESSION_INVALID, message: "over", ref: "r" })) as unknown as typeof fetch,
      { onSessionEnded },
    );

    await expect(client.get("/v1/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it("retries once with the current token when it rotated during the request", async () => {
    let current = "old";
    const seen: (string | null)[] = [];
    const onSessionEnded = vi.fn();
    const client = clientWith(
      (async (_url: unknown, init?: RequestInit) => {
        const auth = (init?.headers as Record<string, string>).authorization;

        seen.push(auth);
        if (auth === "Bearer old") {
          current = "new";
          return json(401, { code: API_CODES.SESSION_INVALID, message: "over" });
        }
        return json(200, { ok: true });
      }) as unknown as typeof fetch,
      { getToken: () => current, onSessionEnded },
    );

    await expect(client.get("/x")).resolves.toEqual({ ok: true });
    expect(seen).toEqual(["Bearer old", "Bearer new"]);
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it("ends the session when the retry with the current token is also a 401", async () => {
    let current = "old";
    const onSessionEnded = vi.fn();
    const client = clientWith(
      (async () => {
        current = "new";
        return json(401, { code: API_CODES.SESSION_INVALID, message: "over" });
      }) as unknown as typeof fetch,
      { getToken: () => current, onSessionEnded },
    );

    await expect(client.get("/x")).rejects.toMatchObject({ status: 401 });
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it("maps a caller abort to an aborted error, before and during fetch", async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    const client = clientWith(fetchImpl as unknown as typeof fetch);
    const early = new AbortController();

    early.abort();
    await expect(client.get("/x", { signal: early.signal })).rejects.toMatchObject({
      kind: "aborted",
      code: API_CODES.ABORTED,
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    const late = new AbortController();
    const hanging = clientWith(((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      })) as unknown as typeof fetch);
    const pending = hanging.get("/x", { signal: late.signal });

    late.abort();
    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });

  it("does not end the session for a wrong password on login", async () => {
    const onSessionEnded = vi.fn();
    const client = clientWith(
      (async () =>
        json(401, { code: API_CODES.UNAUTHORIZED, message: "wrong" })) as unknown as typeof fetch,
      { onSessionEnded },
    );

    await expect(client.post("/v1/auth/login", { anonymous: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it("maps a network failure to API_UNREACHABLE", async () => {
    const client = clientWith((async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch);

    await expect(client.get("/x")).rejects.toMatchObject({
      kind: "network",
      status: 0,
      code: API_CODES.UNREACHABLE,
    });
  });

  it("uploads raw bytes with the given content type", async () => {
    const fetchImpl = vi.fn(async () => json(201, { photo: { id: 5 } }));
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);

    const out = await clientWith(fetchImpl as unknown as typeof fetch).upload(
      "/v1/social/photos",
      bytes,
      "image/jpeg",
    );
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];

    expect(out).toEqual({ photo: { id: 5 } });
    expect(init.body).toBe(bytes);
    expect((init.headers as Record<string, string>)["content-type"]).toBe("image/jpeg");
  });
});
