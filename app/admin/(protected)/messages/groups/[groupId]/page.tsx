import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ROUTES } from "@/constants/routes";
import { GroupThread } from "@/features/chat-groups/components/GroupThread";
import {
  loadGroupActor,
  sessionOfAdmin,
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
import { requireAdmin } from "@/services/auth-guard";
import { getAdminGroupInfoPath } from "@/utils/routes";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("chatGroups.pages");

  return { title: t("threadMeta") };
};

// One group conversation for an admin. A missing group, a PT who is not a
// member and a left PT all get the same 404; a super admin can still open a
// dissolved group, read-only.
const AdminGroupPage = async ({
  params,
}: PageProps<"/admin/messages/groups/[groupId]">) => {
  const admin = await requireAdmin();
  const groupId = parseGroupId((await params).groupId);
  const context = groupId
    ? await loadGroupActor(groupId, sessionOfAdmin(admin))
    : null;

  if (!context) {
    notFound();
  }
  const { group, actor } = context;
  const payload = await loadGroupThread(group, actor, {}, undefined);

  return (
    <GroupThread
      groupId={group.id}
      groupName={group.name}
      avatarSrc={groupAvatarUrl(group.id, avatarVersionOf(group))}
      role="admin"
      viewerId={admin.id}
      viewerKey={actor.key}
      viewerName={admin.username}
      isManager={actor.isManager}
      canManage={actor.canManage}
      canResolveAlert={actor.isSuperAdmin}
      canWriteBase
      initialManagersOnly={payload.group.managersOnly}
      initialDissolved={payload.group.dissolved}
      initial={toThreadSnapshot(payload, {
        viewerKey: actor.key,
        isManager: actor.isManager,
        canWriteBase: true,
      })}
      backHref={ROUTES.ADMIN_MESSAGES}
      infoHref={getAdminGroupInfoPath(group.id)}
    />
  );
};

export default AdminGroupPage;
