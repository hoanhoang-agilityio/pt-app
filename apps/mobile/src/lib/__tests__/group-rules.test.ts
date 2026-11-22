import { describe, expect, it } from "vitest";

import {
  addOutcomeCounts,
  filterCandidates,
  freePlaces,
  matchesSearch,
  selectionToIds,
  toggleSelection,
} from "../group-rules";

describe("matchesSearch", () => {
  it("ignores case and accents and matches everything when empty", () => {
    expect(matchesSearch("DUNG", "Dũng Nguyễn")).toBe(true);
    expect(matchesSearch("dang", "Đặng")).toBe(true);
    expect(matchesSearch("", "x")).toBe(true);
    expect(matchesSearch("zz", "abc")).toBe(false);
  });
});

describe("filterCandidates", () => {
  it("filters by name", () => {
    const list = [
      { key: "user:1", name: "An" },
      { key: "user:2", name: "Bình" },
    ];

    expect(filterCandidates(list, "binh")).toEqual([list[1]]);
  });
});

describe("toggleSelection", () => {
  it("adds, removes and refuses past the cap", () => {
    const one = toggleSelection(new Set(), "user:1", 2);
    const two = toggleSelection(one, "user:2", 2);

    expect([...two]).toEqual(["user:1", "user:2"]);
    expect(toggleSelection(two, "user:3", 2)).toBe(two);
    expect([...toggleSelection(two, "user:1", 2)]).toEqual(["user:2"]);
  });
});

describe("selectionToIds", () => {
  it("splits trainees from PTs, sorted, skipping bad keys", () => {
    expect(selectionToIds(new Set(["user:9", "admin:2", "user:3", "user:0", "x:1", "user:abc"]))).toEqual({
      userIds: [3, 9],
      ptIds: [2],
    });
  });
});

describe("freePlaces / addOutcomeCounts", () => {
  it("does not count super admins", () => {
    expect(freePlaces([{ role: "super_admin" }, { role: "pt" }, { role: "trainee" }])).toBe(48);
  });

  it("counts added and skipped", () => {
    expect(addOutcomeCounts([{ outcome: "added" }, { outcome: "already_member" }, { outcome: "added" }])).toEqual({
      added: 2,
      skipped: 1,
    });
  });
});
