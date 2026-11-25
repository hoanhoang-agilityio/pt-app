import { describe, expect, it } from "vitest";

import type {
  DirectoryAdmin,
  DirectoryTrainee,
} from "@/features/pts/types/directory";
import { buildDirectory, countByFilter } from "@/features/pts/utils/directory";

const admins: DirectoryAdmin[] = [
  {
    id: 1,
    username: "root",
    role: "super_admin",
    verified: true,
    traineeCount: 0,
  },
  { id: 2, username: "coach.an", role: "pt", verified: false, traineeCount: 2 },
  {
    id: 3,
    username: "coach.binh",
    role: "pt",
    verified: false,
    traineeCount: 0,
  },
];

const trainees: DirectoryTrainee[] = [
  { id: 10, name: "Nguyễn Văn A", email: "a@x.com", ptAdminId: 2 },
  { id: 11, name: "Lê B", email: null, ptAdminId: 2 },
  { id: 12, name: "Trần C", email: "c@x.com", ptAdminId: null },
];

const options = (
  filter: "all" | "pt" | "trainee" | "unassigned",
  query = "",
) => ({
  filter,
  query,
  unassignedTitle: "Chưa có PT",
});

describe("countByFilter", () => {
  it("counts every chip", () => {
    expect(countByFilter(admins, trainees)).toEqual({
      all: 6,
      pt: 2,
      trainee: 3,
      unassigned: 1,
    });
  });
});

describe("buildDirectory", () => {
  it("lists admins first, then groups by PT, with Chưa có PT last", () => {
    const view = buildDirectory(admins, trainees, options("all"));

    expect(view.admins.map((a) => a.username)).toEqual([
      "root",
      "coach.an",
      "coach.binh",
    ]);
    expect(view.groups.map((g) => [g.title, g.trainees.length])).toEqual([
      ["coach.an", 2],
      ["coach.binh", 0],
      ["Chưa có PT", 1],
    ]);
    expect(view.isEmpty).toBe(false);
  });

  it("keeps only PT accounts for the PT chip", () => {
    const view = buildDirectory(admins, trainees, options("pt"));

    expect(view.admins.map((a) => a.username)).toEqual([
      "coach.an",
      "coach.binh",
    ]);
    expect(view.groups).toEqual([]);
  });

  it("hides empty PT groups for the trainee chip", () => {
    const view = buildDirectory(admins, trainees, options("trainee"));

    expect(view.admins).toEqual([]);
    expect(view.groups.map((g) => g.title)).toEqual(["coach.an", "Chưa có PT"]);
  });

  it("shows only trainees without a PT for the unassigned chip", () => {
    const view = buildDirectory(admins, trainees, options("unassigned"));

    expect(view.groups).toHaveLength(1);
    expect(view.groups[0].trainees.map((t) => t.name)).toEqual(["Trần C"]);
  });

  it("is empty when every trainee has a PT and the chip is unassigned", () => {
    const view = buildDirectory(
      admins,
      trainees.slice(0, 2),
      options("unassigned"),
    );

    expect(view.isEmpty).toBe(true);
  });

  it("searches names without accents, emails and usernames", () => {
    expect(
      buildDirectory(admins, trainees, options("all", "nguyen")).groups.flatMap(
        (g) => g.trainees.map((t) => t.id),
      ),
    ).toEqual([10]);
    expect(
      buildDirectory(admins, trainees, options("all", "C@X")).groups.flatMap(
        (g) => g.trainees.map((t) => t.id),
      ),
    ).toEqual([12]);
    expect(
      buildDirectory(admins, trainees, options("all", "binh")).admins.map(
        (a) => a.username,
      ),
    ).toEqual(["coach.binh"]);
  });

  it("reports no result for a search that matches nothing", () => {
    const view = buildDirectory(admins, trainees, options("all", "zzz"));

    expect(view.isEmpty).toBe(true);
    expect(view.admins).toEqual([]);
    expect(view.groups).toEqual([]);
  });

  it("puts trainees of an unknown PT into Chưa có PT", () => {
    const view = buildDirectory(
      admins,
      [{ id: 20, name: "Orphan", email: null, ptAdminId: 99 }],
      options("all"),
    );

    expect(view.groups.at(-1)?.trainees.map((t) => t.name)).toEqual(["Orphan"]);
  });

  it("finds a trainee under all that a narrower chip hides", () => {
    // Lê B has a PT, so the unassigned chip is empty while "all" matches.
    expect(
      buildDirectory(admins, trainees, options("unassigned", "Lê B")).isEmpty,
    ).toBe(true);
    expect(
      buildDirectory(admins, trainees, options("all", "Lê B")).isEmpty,
    ).toBe(false);
  });
});
