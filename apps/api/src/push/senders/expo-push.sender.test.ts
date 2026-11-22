import type { PushPayload } from "@pt/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "../../config/env.schema.js";
import type { StoredPushSubscription } from "../push-sender.js";
import {
  EXPO_BATCH_SIZE,
  EXPO_PUSH_URL,
  expoDataOf,
  ExpoPushSender,
} from "./expo-push.sender.js";

const payload: PushPayload = {
  title: "An",
  body: "hello",
  url: "/messages/coach",
  tag: "chat-7",
};

const sub = (id: number): StoredPushSubscription => ({
  id,
  ownerKey: "user:1",
  kind: "expo",
  endpoint: `ExponentPushToken[tok${id}]`,
  p256dh: null,
  auth: null,
});

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const env = (values: Partial<Env> = {}) => values as Env;

const sentMessages = (call: unknown[]) =>
  JSON.parse((call[1] as RequestInit).body as string) as Record<
    string,
    unknown
  >[];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("expoDataOf", () => {
  it("reads the kind and ids from the tag", () => {
    expect(expoDataOf(payload)).toEqual({
      url: "/messages/coach",
      tag: "chat-7",
      kind: "chat_message",
      ids: { conversationId: 7 },
    });
    expect(expoDataOf({ ...payload, tag: "chat-react-7" }).kind).toBe(
      "chat_reaction",
    );
    expect(expoDataOf({ ...payload, tag: "chat-group-3" })).toMatchObject({
      kind: "group_message",
      ids: { groupId: 3 },
    });
    expect(expoDataOf({ ...payload, tag: "social-comment-9" })).toMatchObject({
      kind: "social",
      ids: { postId: 9 },
    });
    expect(expoDataOf({ ...payload, tag: "social-friend_request" }).kind).toBe(
      "social",
    );
    expect(expoDataOf({ ...payload, tag: "reports" }).kind).toBe("report");
  });
});

describe("ExpoPushSender", () => {
  it("posts one message per device with data, and the badge when given", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        reply({ data: [{ status: "ok" }, { status: "ok" }] }),
      );

    vi.stubGlobal("fetch", fetchMock);
    const results = await new ExpoPushSender(env()).sendMany([sub(1), sub(2)], {
      ...payload,
      badge: 4,
    });
    const sent = sentMessages(fetchMock.mock.calls[0] ?? []);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(EXPO_PUSH_URL);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      to: "ExponentPushToken[tok1]",
      title: "An",
      body: "hello",
      badge: 4,
      data: { url: "/messages/coach", kind: "chat_message" },
    });
    expect([...results]).toEqual([
      [1, "ok"],
      [2, "ok"],
    ]);
  });

  it("leaves the badge out when the payload has none, and sends the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => reply({ data: [{ status: "ok" }] }));

    vi.stubGlobal("fetch", fetchMock);
    await new ExpoPushSender(env({ EXPO_ACCESS_TOKEN: "secret" })).send(
      sub(1),
      payload,
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(
      "badge" in (sentMessages(fetchMock.mock.calls[0] ?? [])[0] ?? {}),
    ).toBe(false);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret",
    );
  });

  it("splits more than 100 devices into batches of 100", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
      const count = (JSON.parse(init.body as string) as unknown[]).length;

      return reply({
        data: Array.from({ length: count }, () => ({ status: "ok" })),
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    const devices = Array.from({ length: 250 }, (_, i) => sub(i + 1));
    const results = await new ExpoPushSender(env()).sendMany(devices, payload);

    expect(EXPO_BATCH_SIZE).toBe(100);
    expect(
      fetchMock.mock.calls.map((call) => sentMessages(call).length),
    ).toEqual([100, 100, 50]);
    expect(results.size).toBe(250);
  });

  it("reports DeviceNotRegistered as gone and other ticket errors as failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        reply({
          data: [
            { status: "ok" },
            { status: "error", details: { error: "DeviceNotRegistered" } },
            { status: "error", details: { error: "MessageTooBig" } },
            { status: "error", details: { error: "MessageRateExceeded" } },
          ],
        }),
      ),
    );
    const results = await new ExpoPushSender(env()).sendMany(
      [sub(1), sub(2), sub(3), sub(4)],
      payload,
    );

    expect([...results]).toEqual([
      [1, "ok"],
      [2, "gone"],
      [3, "failed"],
      [4, "retry"],
    ]);
  });

  it("retries on 429, 5xx and a network failure, but not on a 4xx", async () => {
    const sender = new ExpoPushSender(env());

    vi.stubGlobal("fetch", () => reply({}, 429));
    expect(await sender.send(sub(1), payload)).toBe("retry");
    vi.stubGlobal("fetch", () => reply({}, 503));
    expect(await sender.send(sub(1), payload)).toBe("retry");
    vi.stubGlobal("fetch", () => Promise.reject(new Error("ECONNRESET")));
    expect(await sender.send(sub(1), payload)).toBe("retry");
    vi.stubGlobal("fetch", () => reply({}, 400));
    expect(await sender.send(sub(1), payload)).toBe("failed");
  });
});

describe("ExpoPushSender timeout", () => {
  it("passes a 10 second abort signal to fetch", async () => {
    const fetchMock = vi.fn(() => reply({ data: [{ status: "ok" }] }));

    vi.stubGlobal("fetch", fetchMock);
    await new ExpoPushSender(env()).send(sub(1), payload);
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;

    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns a timeout abort into a retryable failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(new DOMException("timed out", "TimeoutError")),
      ),
    );

    expect(await new ExpoPushSender(env()).send(sub(1), payload)).toBe("retry");
  });

  it("uses AbortSignal.timeout(10000)", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");

    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply({ data: [{ status: "ok" }] })),
    );
    await new ExpoPushSender(env()).send(sub(1), payload);

    expect(timeout).toHaveBeenCalledWith(10_000);
    timeout.mockRestore();
  });
});

describe("ExpoPushSender enabled flag", () => {
  const enabled = (values: Partial<Env>) =>
    new ExpoPushSender(env(values)).enabled;

  it("is on by default, off with EXPO_PUSH_ENABLED=false", () => {
    expect(enabled({})).toBe(true);
    expect(enabled({ NODE_ENV: "production" })).toBe(true);
    expect(enabled({ EXPO_PUSH_ENABLED: "false" })).toBe(false);
  });

  it("is off under NODE_ENV=test unless explicitly true", () => {
    expect(enabled({ NODE_ENV: "test" })).toBe(false);
    expect(enabled({ NODE_ENV: "test", EXPO_PUSH_ENABLED: "true" })).toBe(true);
  });
});
