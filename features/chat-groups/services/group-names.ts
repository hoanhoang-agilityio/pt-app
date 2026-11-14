import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { admins, users } from "@/db/schema";
import type { GroupRole } from "@/features/chat-groups/types/group";
import { loadAliases } from "@/features/contact-aliases/services/contact-aliases";
import { parseActorRef } from "@/features/contact-aliases/utils/alias-rules";
import { toAdminRole } from "@/services/admin-scope";

export interface ActorIdentity {
  // Real name (users.name / admins.username).
  name: string;
  role: GroupRole;
}

// Real names and roles of member keys. Keys of deleted accounts are absent.
export const loadActorIdentities = async (
  keys: Iterable<string>,
): Promise<Map<string, ActorIdentity>> => {
  const refs = [...new Set(keys)].flatMap((key) => {
    const ref = parseActorRef(key);

    return ref ? [{ key, ...ref }] : [];
  });
  const userIds = refs.filter((ref) => ref.kind === "user").map((r) => r.id);
  const adminIds = refs.filter((ref) => ref.kind === "admin").map((r) => r.id);
  const [userRows, adminRows] = await Promise.all([
    userIds.length
      ? db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds))
      : [],
    adminIds.length
      ? db
          .select({
            id: admins.id,
            username: admins.username,
            role: admins.role,
          })
          .from(admins)
          .where(inArray(admins.id, adminIds))
      : [],
  ]);
  const result = new Map<string, ActorIdentity>();

  for (const row of userRows) {
    result.set(`user:${row.id}`, { name: row.name, role: "trainee" });
  }
  for (const row of adminRows) {
    result.set(`admin:${row.id}`, {
      name: row.username,
      role: toAdminRole(row.role),
    });
  }
  return result;
};

// What the viewer sees for each key: their private nickname first, else the
// real name; null for a deleted account (the UI shows "Deleted member").
export const loadShownNames = async (
  viewerKey: string,
  keys: Iterable<string>,
) => {
  const wanted = [...new Set(keys)];
  const [identities, aliases] = await Promise.all([
    loadActorIdentities(wanted),
    loadAliases(viewerKey, wanted),
  ]);

  return {
    identities,
    nameOf: (key: string): string | null => {
      const identity = identities.get(key);

      if (!identity) {
        return null;
      }
      return aliases.get(key)?.trim() || identity.name;
    },
  };
};
