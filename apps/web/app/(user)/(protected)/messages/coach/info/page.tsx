import { INT4_MAX } from "@pt/contracts";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ChatInfo } from "@/features/chat/components/ChatInfo";
import { listGalleryPhotos } from "@/features/chat/services/chat-gallery";
import { loadMyThread } from "@/features/chat/services/chat-queries";
import { listAdminAvatarUrls } from "@/features/chat/services/chat-team";
import { chatPaths } from "@/features/chat/utils/chat-links";
import { pickCoachAvatar } from "@/features/chat/utils/chat-thread-rules";
import { INFO_PREVIEW_COUNT } from "@/features/chat/utils/gallery-rules";
import { requireUser } from "@/services/auth-guard";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("chat.pages");

  return { title: t("infoTitle") };
};

// The trainee's chat info page (KAN-160). The chat may be locked: the page
// still opens, read-only, like the thread does.
const MessagesInfoPage = async () => {
  const t = await getTranslations("chat.shared");
  const user = await requireUser();
  // The thread answer carries the nicknames, colours, the chat switch and the
  // PT who wrote last; only its first page of messages is not needed here.
  const [state, adminAvatars] = await Promise.all([
    loadMyThread({ after: INT4_MAX }),
    listAdminAvatarUrls("user"),
  ]);
  const sender = state.latestPt;
  const gallery = await listGalleryPhotos(
    state.conversationId,
    INFO_PREVIEW_COUNT,
  );

  return (
    <ChatInfo
      viewer={{ role: "user" }}
      userId={user.id}
      conversationId={state.conversationId}
      peerName={sender?.name ?? t("fallbackPeer")}
      selfName={user.name}
      initialProfile={state.profile}
      chatEnabled={state.chatEnabled}
      peerAvatarUrl={pickCoachAvatar(
        sender?.id ?? null,
        user.ptAdminId,
        adminAvatars,
      )}
      paths={chatPaths("user", user.id)}
      preview={gallery.items}
    />
  );
};

export default MessagesInfoPage;
