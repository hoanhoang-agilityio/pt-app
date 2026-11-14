import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppHeader } from "@/components/layout/AppHeader";
import { GroupInfo } from "@/features/chat-groups/components/GroupInfo";
import {
  loadGroupActor,
  sessionOfAdmin,
} from "@/features/chat-groups/services/group-access";
import { listGroupCandidates } from "@/features/chat-groups/services/group-candidates";
import {
  avatarVersionOf,
  listGroupMembers,
  listGroupsForSession,
} from "@/features/chat-groups/services/group-queries";
import { parseGroupId } from "@/features/chat-groups/utils/group-rules";
import { requireAdmin } from "@/services/auth-guard";
import { getAdminGroupPath } from "@/utils/routes";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("chatGroups.pages");

  return { title: t("infoTitle") };
};

// The group info page: members, and for whoever can manage the controls to
// change the group. Same access rule as the thread (404 for non-members).
const AdminGroupInfoPage = async ({
  params,
}: PageProps<"/admin/messages/groups/[groupId]/info">) => {
  const t = await getTranslations("chatGroups.pages");
  const admin = await requireAdmin();
  const groupId = parseGroupId((await params).groupId);
  const session = sessionOfAdmin(admin);
  const context = groupId ? await loadGroupActor(groupId, session) : null;

  if (!context || session.kind !== "admin") {
    notFound();
  }
  const { group, actor } = context;
  const members = await listGroupMembers(group, actor);
  const [candidates, summaries] = await Promise.all([
    actor.canManage && group.dissolvedAt === null
      ? listGroupCandidates(session, new Set(members.map((m) => m.key)))
      : { trainees: [], pts: [] },
    listGroupsForSession(session),
  ]);
  const summary = summaries.find((item) => item.id === group.id);

  return (
    <>
      <AppHeader
        title={t("infoTitle")}
        backHref={getAdminGroupPath(group.id)}
      />
      <GroupInfo
        group={{
          id: group.id,
          name: group.name,
          avatarVersion: avatarVersionOf(group),
          managersOnly: group.managersOnly === true,
          dissolved: group.dissolvedAt !== null,
        }}
        members={members}
        candidates={candidates}
        viewerKey={actor.key}
        canManage={actor.canManage}
        isSuperAdmin={actor.isSuperAdmin}
        initialMuted={summary?.muted ?? false}
      />
    </>
  );
};

export default AdminGroupInfoPage;
