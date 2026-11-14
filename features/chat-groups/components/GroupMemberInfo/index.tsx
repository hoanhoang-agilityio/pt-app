"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Avatar } from "@/components/common/Avatar";
import { useConfirm } from "@/components/common/ConfirmDialog/use-confirm";
import { Spinner } from "@/components/common/Spinner";
import { ROUTES } from "@/constants/routes";
import {
  BUTTON_DANGER,
  CARD,
  FIELD_ERROR,
  PAGE_CONTAINER,
  SECTION_TITLE,
} from "@/constants/styles";
import { GroupSwitchRow } from "@/features/chat-groups/components/GroupSwitchRow";
import {
  leaveGroupAction,
  setGroupMutedAction,
} from "@/features/chat-groups/services/group-actions";
import type {
  GroupMemberView,
  GroupRole,
} from "@/features/chat-groups/types/group";
import { groupAvatarUrl } from "@/features/chat-groups/utils/group-thread-map";
import { useLocalizeMessage } from "@/i18n/use-localize-message";

interface GroupMemberInfoProps {
  group: {
    id: number;
    name: string;
    avatarVersion: number | null;
    managersOnly: boolean;
  };
  members: GroupMemberView[];
  // "user:<id>" of the viewer, to mark their own row.
  viewerKey: string;
  initialMuted: boolean;
}

const ROLE_KEY = {
  super_admin: "role.manager",
  pt: "role.pt",
  trainee: "role.trainee",
} as const satisfies Record<GroupRole, string>;

// The group info page of a trainee: who is in the group (Manager, PT or
// trainee label), mute and leave. Rows are plain text on purpose: there is no
// profile and no private message to open from a member (spec G5).
export const GroupMemberInfo = ({
  group,
  members,
  viewerKey,
  initialMuted,
}: GroupMemberInfoProps) => {
  const t = useTranslations("chatGroups");
  const router = useRouter();
  const confirm = useConfirm();
  const localize = useLocalizeMessage();
  const [muted, setMuted] = useState(initialMuted);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"mute" | "leave" | null>(null);
  const [, startTransition] = useTransition();

  const toggleMute = (next: boolean) => {
    setMuted(next);
    setBusy("mute");
    setError(null);
    startTransition(async () => {
      try {
        const result = await setGroupMutedAction({
          groupId: group.id,
          muted: next,
        });

        if (result.status === "error") {
          setMuted(!next);
          setError(localize(result.message));
          return;
        }
        router.refresh();
      } catch {
        setMuted(!next);
        setError(t("info.failed"));
      } finally {
        setBusy(null);
      }
    });
  };

  const leave = async () => {
    const isConfirmed = await confirm({
      title: t("info.leaveTitle"),
      description: t("info.leaveTraineeDescription"),
      confirmLabel: t("info.leave"),
      isDanger: true,
    });

    if (!isConfirmed) {
      return;
    }
    setBusy("leave");
    setError(null);
    startTransition(async () => {
      try {
        const result = await leaveGroupAction({ groupId: group.id });

        if (result.status === "error") {
          setError(localize(result.message));
          return;
        }
        router.replace(ROUTES.MESSAGES);
        router.refresh();
      } catch {
        setError(t("info.leaveFailed"));
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <main
      className={`${PAGE_CONTAINER} space-y-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]`}
    >
      <section className="flex flex-col items-center gap-3 text-center">
        <Avatar
          name={group.name}
          src={groupAvatarUrl(group.id, group.avatarVersion)}
          tone="soft"
          className="size-24 text-3xl"
        />
        <h2 className="text-xl font-bold text-fg">{group.name}</h2>
        {group.managersOnly && (
          <p role="status" className="text-sm text-muted">
            {t("info.managersOnlyNote")}
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className={FIELD_ERROR}>
          {error}
        </p>
      )}

      <section className="space-y-2">
        <h2 className={SECTION_TITLE}>
          {t("info.members", { count: members.length })}
        </h2>
        <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
          {members.map((member) => (
            <li
              key={member.key}
              className="flex min-h-14 items-center gap-3 px-4 py-2"
            >
              <Avatar
                name={member.name}
                tone="soft"
                className="size-9 text-xs"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">
                  {member.name}
                  {member.key === viewerKey && (
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      ({t("info.you")})
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted">
                  {t(ROLE_KEY[member.role])}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className={SECTION_TITLE}>{t("info.notificationsSection")}</h2>
        <GroupSwitchRow
          label={t("info.mute")}
          hint={t("info.muteHint")}
          checked={muted}
          isPending={busy === "mute"}
          onChange={toggleMute}
        />
      </section>

      <section>
        <button
          type="button"
          disabled={busy !== null}
          aria-busy={busy === "leave"}
          onClick={() => void leave()}
          className={`${BUTTON_DANGER} w-full`}
        >
          {busy === "leave" && <Spinner size="sm" />}
          {t("info.leave")}
        </button>
      </section>
    </main>
  );
};
