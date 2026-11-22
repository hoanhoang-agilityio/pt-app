import { describe, expect, it, vi } from "vitest";

import type { AuthActor } from "../auth/actor.js";
import { ChatService } from "./chat.service.js";

const superAdmin = { kind: "admin", id: 1, role: "super_admin" } as AuthActor;

const serviceWith = (views: { many: ReturnType<typeof vi.fn> }) => {
  const access = {
    forMessage: vi.fn().mockResolvedValue({ stored: { deletedAt: new Date() } }),
  };
  const queries = {
    findMessageRow: vi.fn().mockResolvedValue({ id: 5 }),
    unsentAt: vi.fn().mockResolvedValue(new Date("2026-01-01T00:00:00Z")),
  };

  return new ChatService(
    {} as never,
    queries as never,
    access as never,
    views as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
};

describe("ChatService.original", () => {
  it("answers message-not-found when the view returns no message", async () => {
    const service = serviceWith({ many: vi.fn().mockResolvedValue([]) });

    await expect(service.original(superAdmin, 5)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns the original, marked deleted, with the unsend time", async () => {
    const service = serviceWith({
      many: vi.fn().mockResolvedValue([{ id: 5, body: "hi" }]),
    });

    await expect(service.original(superAdmin, 5)).resolves.toEqual({
      message: { id: 5, body: "hi", deleted: true },
      unsentAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
