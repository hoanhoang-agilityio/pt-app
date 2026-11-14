import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppHeader } from "@/components/layout/AppHeader";
import { GroupMemberInfo } from "@/features/chat-groups/components/GroupMemberInfo";
import {
  loadGroupActor,
  sessionOfUser,
} from "@/features/chat-groups/services/group-access";
import {
  avatarVersionOf,
  listGroupMembers,
  listGroupsForSession,
} from "@/features/chat-groups/services/group-queries";
import { parseGroupId } from "@/features/chat-groups/utils/group-rules";
import { requireUser } from "@/services/auth-guard";
import { getUserGroupPath } from "@/utils/routes";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("chatGroups.pages");

  return { title: t("infoTitle") };
};

// The trainee's group info page: members with their label, mute and leave.
// No add, remove or rename controls, and no member row opens anything. Same
// 404 rule as the thread.
const UserGroupInfoPage = async ({
  params,
}: PageProps<"/messages/groups/[groupId]/info">) => {
  const t = await getTranslations("chatGroups.pages");
  const user = await requireUser();
  const groupId = parseGroupId((await params).groupId);
  const session = sessionOfUser(user);
  const context = groupId ? await loadGroupActor(groupId, session) : null;

  if (!context) {
    notFound();
  }
  const { group, actor } = context;
  const [members, summaries] = await Promise.all([
    listGroupMembers(group, actor),
    listGroupsForSession(session),
  ]);
  const summary = summaries.find((item) => item.id === group.id);

  return (
    <>
      <AppHeader title={t("infoTitle")} backHref={getUserGroupPath(group.id)} />
      <GroupMemberInfo
        group={{
          id: group.id,
          name: group.name,
          avatarVersion: avatarVersionOf(group),
          managersOnly: group.managersOnly === true,
        }}
        members={members}
        viewerKey={actor.key}
        initialMuted={summary?.muted ?? false}
      />
    </>
  );
};

export default UserGroupInfoPage;
