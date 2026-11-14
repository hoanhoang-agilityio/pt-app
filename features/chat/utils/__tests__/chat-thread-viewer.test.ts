import { describe, expect, it } from "vitest";

import {
  buildThreadItems,
  mergeMessages,
  newestPeerMessageId,
  type SerializedChatMessage,
  type ThreadViewer,
  viewerReactorKey,
  withMyReaction,
} from "@/features/chat/utils/chat-thread-rules";

// Characterization tests written before the viewer union was widened for
// group chat: they pin how the coach chat decides "mine", names, run breaks
// and the reactor key, so any later change has to keep them green.

const NOW = Date.parse("2026-11-04T05:00:00.000Z");

const msg = (
  id: number,
  overrides: Partial<SerializedChatMessage> = {},
): SerializedChatMessage => ({
  id,
  senderRole: "admin",
  senderAdminId: 1,
  senderAdminName: "Hoan",
  body: `m${id}`,
  clientId: `c${id}`,
  createdAt: "2026-11-04T03:00:00.000Z",
  replyTo: null,
  editedAt: null,
  deleted: false,
  updatedAt: "2026-11-04T03:00:00.000Z",
  reactions: [],
  ...overrides,
});

const fromTrainee = (id: number) =>
  msg(id, { senderRole: "user", senderAdminId: null, senderAdminName: null });

const admin: ThreadViewer = {
  role: "admin",
  adminId: 1,
  adminName: "Hoan",
  peerName: "Lan",
};
const trainee: ThreadViewer = { role: "user" };

const items = (list: SerializedChatMessage[], viewer: ThreadViewer) =>
  buildThreadItems(mergeMessages([], list), 0, NOW, viewer).flatMap((item) =>
    item.kind === "message" ? [item] : [],
  );

describe("thread items by viewer (coach chat)", () => {
  const thread = [
    fromTrainee(1),
    msg(2),
    msg(3, { senderAdminId: 2, senderAdminName: "Minh" }),
  ];

  it("trainee: only their own side is mine, PT names show on the left", () => {
    const [own, pt1, pt2] = items(thread, trainee);

    expect([own.mine, pt1.mine, pt2.mine]).toEqual([true, false, false]);
    expect(own.senderName).toBeNull();
    expect(pt1.senderName).toBe("Hoan");
    expect(pt2.senderName).toBe("Minh");
  });

  it("admin: every admin message is mine, only a colleague is named", () => {
    const [peer, own, colleague] = items(thread, admin);

    expect([peer.mine, own.mine, colleague.mine]).toEqual([false, true, true]);
    expect([peer.senderName, own.senderName]).toEqual([null, null]);
    expect(colleague.senderName).toBe("Minh");
  });

  it("two different admins never share a run", () => {
    const [first, second] = items(
      [msg(1), msg(2, { senderAdminId: 2, senderAdminName: "Minh" })],
      trainee,
    );

    expect(first.isLastInRun).toBe(true);
    expect(second.isFirstInRun).toBe(true);
  });

  it("the avatar sits on the last bubble of the other side's run only", () => {
    const [a, b] = items([msg(1), msg(2)], trainee);

    expect([a.showAvatar, b.showAvatar]).toEqual([false, true]);
    expect(b.avatarName).toBe("Hoan");
  });
});

describe("viewer keys and read cursor", () => {
  it("identifies reactors as user or admin:<id>", () => {
    expect(viewerReactorKey(trainee)).toBe("user");
    expect(viewerReactorKey(admin)).toBe("admin:1");
  });

  it("names my reaction 'Bạn' for a trainee and the username for an admin", () => {
    expect(withMyReaction([], trainee, "❤️")).toEqual([
      { emoji: "❤️", reactorKey: "user", reactorName: "Bạn" },
    ]);
    expect(withMyReaction([], admin, "👍")).toEqual([
      { emoji: "👍", reactorKey: "admin:1", reactorName: "Hoan" },
    ]);
  });

  it("the newest peer message is the PT's for a trainee, the trainee's for an admin", () => {
    const list = mergeMessages(
      [],
      [msg(1), fromTrainee(2), msg(3), fromTrainee(4), msg(5)],
    );

    expect(newestPeerMessageId(list, "user")).toBe(5);
    expect(newestPeerMessageId(list, "admin")).toBe(4);
  });
});
