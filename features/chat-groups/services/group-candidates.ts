import "server-only";

import { and, asc, eq, notInArray } from "drizzle-orm";

import { db } from "@/db";
import { admins, users } from "@/db/schema";
import { loadShownNames } from "@/features/chat-groups/services/group-names";
import type { GroupSession } from "@/features/chat-groups/types/group";
import { sessionKey } from "@/features/chat-groups/utils/group-rules";
import { toAdminRole } from "@/services/admin-scope";
import { hiddenUserIdsOf } from "@/services/hidden-users";

export interface GroupCandidate {
  // "user:<id>" | "admin:<id>", the member key.
  key: string;
  kind: "user" | "admin";
  id: number;
  // The viewer's nickname first, else the real name.
  name: string;
}

export interface GroupCandidates {
  trainees: GroupCandidate[];
  // PTs, for a super admin only (G3: a PT cannot add other PTs).
  pts: GroupCandidate[];
}

type AdminSession = Extract<GroupSession, { kind: "admin" }>;

// Who the picker of the create and add screens offers (G1): a PT their own
// trainees that they have not hidden, a super admin every trainee and every PT.
// This only fills the list; the add action checks the same rule again, so a
// forged id is skipped there. `exclude` drops people who are already in.
export const listGroupCandidates = async (
  session: AdminSession,
  exclude: ReadonlySet<string> = new Set(),
): Promise<GroupCandidates> => {
  const isSuper = toAdminRole(session.role) === "super_admin";
  const [traineeRows, ptRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(
        isSuper
          ? undefined
          : and(
              eq(users.ptAdminId, session.id),
              notInArray(users.id, hiddenUserIdsOf(session.id)),
            ),
      )
      .orderBy(asc(users.nameKey)),
    isSuper
      ? db
          .select({ id: admins.id, name: admins.username })
          .from(admins)
          .where(eq(admins.role, "pt"))
          .orderBy(asc(admins.usernameKey))
      : [],
  ]);
  const rows = [
    ...traineeRows.map((row) => ({ ...row, kind: "user" as const })),
    ...ptRows.map((row) => ({ ...row, kind: "admin" as const })),
  ]
    .map((row) => ({ ...row, key: `${row.kind}:${row.id}` }))
    .filter((row) => !exclude.has(row.key));
  const { nameOf } = await loadShownNames(
    sessionKey(session),
    rows.map((row) => row.key),
  );
  const toCandidate = (row: (typeof rows)[number]): GroupCandidate => ({
    key: row.key,
    kind: row.kind,
    id: row.id,
    name: nameOf(row.key) ?? row.name,
  });

  return {
    trainees: rows.filter((row) => row.kind === "user").map(toCandidate),
    pts: rows.filter((row) => row.kind === "admin").map(toCandidate),
  };
};
