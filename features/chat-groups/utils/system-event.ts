import { z } from "zod";

// The JSON of a `kind = 'system'` row. Names are not stored: they are looked
// up at read time, so renames of people and language changes show correctly.

const actorKey = z.string().regex(/^(user|admin):[1-9]\d{0,14}$/);
const id = z.number().int().positive();

export const ptChangeResolutionSchema = z.object({
  choice: z.enum(["keep", "remove", "superseded"]),
  // The super admin who chose; null for "superseded" (a newer change did).
  byAdminId: id.nullable(),
  at: z.number().int().nonnegative(),
});

export const systemEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("member_added"),
    actorKey,
    memberKeys: z.array(actorKey).min(1).max(100),
  }),
  z.object({
    type: z.literal("member_removed"),
    actorKey,
    memberKey: actorKey,
  }),
  z.object({ type: z.literal("member_left"), memberKey: actorKey }),
  z.object({
    type: z.literal("renamed"),
    actorKey,
    from: z.string().max(200),
    to: z.string().max(200),
  }),
  z.object({ type: z.literal("avatar_changed"), actorKey }),
  z.object({
    type: z.literal("managers_only"),
    actorKey,
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal("pt_changed"),
    userId: id,
    fromPtId: id.nullable(),
    toPtId: id.nullable(),
    resolution: ptChangeResolutionSchema.nullable(),
  }),
]);

export type SystemEvent = z.infer<typeof systemEventSchema>;
export type PtChangeEvent = Extract<SystemEvent, { type: "pt_changed" }>;
export type PtChangeResolution = z.infer<typeof ptChangeResolutionSchema>;

// Validates before it is stored: a bad event is a bug, never a row.
export const serializeSystemEvent = (event: SystemEvent) =>
  JSON.stringify(systemEventSchema.parse(event));

// Stored JSON back to an event; null for anything that is not a valid event
// (hand-edited rows, a future event type an older server does not know).
export const parseSystemEvent = (raw: string | null): SystemEvent | null => {
  if (raw === null) {
    return null;
  }
  try {
    const parsed = systemEventSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export interface SystemLine {
  // i18n key under the chatGroups namespace, "systemLine.<type>".
  key: string;
  params: Record<string, string | number>;
}

// Member keys the line names, for the caller's single name lookup.
export const systemEventKeys = (event: SystemEvent): string[] => {
  switch (event.type) {
    case "member_added":
      return [event.actorKey, ...event.memberKeys];
    case "member_removed":
      return [event.actorKey, event.memberKey];
    case "member_left":
      return [event.memberKey];
    case "renamed":
    case "avatar_changed":
    case "managers_only":
      return [event.actorKey];
    case "pt_changed":
      return [
        `user:${event.userId}`,
        ...(event.fromPtId ? [`admin:${event.fromPtId}`] : []),
        ...(event.toPtId ? [`admin:${event.toPtId}`] : []),
        ...(event.resolution?.byAdminId
          ? [`admin:${event.resolution.byAdminId}`]
          : []),
      ];
  }
};

// Which key and params render the line; the text itself comes from i18n in
// the reader's language. `nameOf` returns the shown name (alias or real name,
// or the "deleted member" text) for a member key. Null event = a row this
// server cannot read: a neutral fallback line.
export const toSystemLine = (
  event: SystemEvent | null,
  nameOf: (memberKey: string) => string,
): SystemLine => {
  if (!event) {
    return { key: "systemLine.unknown", params: {} };
  }
  switch (event.type) {
    case "member_added":
      return {
        key: "systemLine.member_added",
        params: {
          actor: nameOf(event.actorKey),
          members: event.memberKeys.map(nameOf).join(", "),
          count: event.memberKeys.length,
        },
      };
    case "member_removed":
      return {
        key: "systemLine.member_removed",
        params: {
          actor: nameOf(event.actorKey),
          member: nameOf(event.memberKey),
        },
      };
    case "member_left":
      return {
        key: "systemLine.member_left",
        params: { member: nameOf(event.memberKey) },
      };
    case "renamed":
      return {
        key: "systemLine.renamed",
        params: {
          actor: nameOf(event.actorKey),
          from: event.from,
          to: event.to,
        },
      };
    case "avatar_changed":
      return {
        key: "systemLine.avatar_changed",
        params: { actor: nameOf(event.actorKey) },
      };
    case "managers_only":
      return {
        key: event.enabled
          ? "systemLine.managers_only_on"
          : "systemLine.managers_only_off",
        params: { actor: nameOf(event.actorKey) },
      };
    case "pt_changed":
      return {
        key: `systemLine.pt_changed_${event.resolution?.choice ?? "open"}`,
        params: {
          member: nameOf(`user:${event.userId}`),
          from: event.fromPtId ? nameOf(`admin:${event.fromPtId}`) : "",
          to: event.toPtId ? nameOf(`admin:${event.toPtId}`) : "",
          by: event.resolution?.byAdminId
            ? nameOf(`admin:${event.resolution.byAdminId}`)
            : "",
        },
      };
  }
};
