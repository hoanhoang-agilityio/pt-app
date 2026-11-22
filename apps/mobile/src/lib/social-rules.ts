import {
  emailSchema,
  type SocialRelationship,
  type SocialReportTargetKind,
} from "@pt/contracts";

// Pure rules of friends, blocks and reports (mirrors the web's
// features/social/utils/friend-rules.ts).

// Exact search only: the whole address, trimmed and lower-cased. Anything that
// is not a full email is rejected so a prefix never matches.
export const parseSearchEmail = (value: string): string | null => {
  const parsed = emailSchema.safeParse(value);

  return parsed.success ? parsed.data.trim().toLowerCase() : null;
};

export type RelationshipAction =
  | "add"
  | "cancel"
  | "accept"
  | "decline"
  | "unfriend";

// Which buttons a person row or profile offers for each relationship.
export const actionsFor = (relationship: SocialRelationship): RelationshipAction[] => {
  switch (relationship) {
    case "none":
      return ["add"];
    case "sent":
      return ["cancel"];
    case "received":
      return ["accept", "decline"];
    case "friends":
      return ["unfriend"];
  }
};

// Reports of a chat message need a reason code; the rest may go without.
export const reportNeedsReason = (kind: SocialReportTargetKind) =>
  kind === "message" || kind === "group_message";

// The id a notification opens: friend events open the friends screen.
export const notificationTarget = (item: {
  kind: string;
  postId: number | null;
  actorKey: string;
}) =>
  item.postId !== null
    ? { type: "post" as const, id: item.postId }
    : item.kind === "friend_request"
      ? { type: "friends" as const }
      : { type: "profile" as const, key: item.actorKey };
