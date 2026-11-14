import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ROUTES } from "@/constants/routes";
import { isChatEnabled } from "@/features/chat/services/chat-permission";
import { GroupThread } from "@/features/chat-groups/components/GroupThread";
import {
  loadGroupActor,
  loadTraineeRestriction,
  sessionOfUser,
} from "@/features/chat-groups/services/group-access";
import {
  avatarVersionOf,
  loadGroupThread,
} from "@/features/chat-groups/services/group-queries";
import { parseGroupId } from "@/features/chat-groups/utils/group-rules";
import {
  groupAvatarUrl,
  toThreadSnapshot,
} from "@/features/chat-groups/utils/group-thread-map";
import { requireUser } from "@/services/auth-guard";
import { getUserGroupInfoPath } from "@/utils/routes";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("chatGroups.pages");

  return { title: t("threadMeta") };
};

// One group conversation for a trainee. A missing group, a dissolved one, a
// group they are not in and one they left all answer the same 404. Reading
// stays open when chat is off, the account is restricted or the group is
// managers-only: the composer turns into a banner instead.
const UserGroupPage = async ({
  params,
}: PageProps<"/messages/groups/[groupId]">) => {
  const user = await requireUser();
  const groupId = parseGroupId((await params).groupId);
  const context = groupId
    ? await loadGroupActor(groupId, sessionOfUser(user))
    : null;

  if (!context) {
    notFound();
  }
  const { group, actor } = context;
  const [payload, restriction] = await Promise.all([
    loadGroupThread(group, actor, {}, undefined),
    loadTraineeRestriction(user.id),
  ]);
  const lockReason = !isChatEnabled(user)
    ? "chat_off"
    : restriction !== null
      ? "restricted"
      : null;
  const canWriteBase = lockReason === null;

  return (
    <GroupThread
      groupId={group.id}
      groupName={group.name}
      avatarSrc={groupAvatarUrl(group.id, avatarVersionOf(group))}
      role="user"
      viewerId={user.id}
      viewerKey={actor.key}
      viewerName={user.name}
      isManager={actor.isManager}
      canManage={actor.canManage}
      canResolveAlert={false}
      canWriteBase={canWriteBase}
      lockReason={lockReason}
      initialManagersOnly={payload.group.managersOnly}
      initialDissolved={payload.group.dissolved}
      initial={toThreadSnapshot(payload, {
        viewerKey: actor.key,
        isManager: actor.isManager,
        canWriteBase,
      })}
      backHref={ROUTES.MESSAGES}
      infoHref={getUserGroupInfoPath(group.id)}
    />
  );
};

export default UserGroupPage;
