import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { CreateGroupForm } from "@/features/chat-groups/components/CreateGroupForm";
import { sessionOfAdmin } from "@/features/chat-groups/services/group-access";
import { listGroupCandidates } from "@/features/chat-groups/services/group-candidates";
import { requireAdmin } from "@/services/auth-guard";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("chatGroups.pages");

  return { title: t("createTitle") };
};

// Create a group: a super admin picks any trainee and PT, a PT only their own
// trainees. The picker list is scoped here and again by the create action.
const AdminNewGroupPage = async () => {
  const t = await getTranslations("chatGroups.pages");
  const admin = await requireAdmin();
  const session = sessionOfAdmin(admin);

  if (session.kind !== "admin") {
    notFound();
  }
  const candidates = await listGroupCandidates(session);

  return (
    <>
      <AppHeader title={t("createTitle")} backHref={ROUTES.ADMIN_MESSAGES} />
      <CreateGroupForm
        candidates={candidates}
        isSuperAdmin={
          session.kind === "admin" && session.role === "super_admin"
        }
      />
    </>
  );
};

export default AdminNewGroupPage;
