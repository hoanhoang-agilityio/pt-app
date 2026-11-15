import { HeaderMenus } from "@/components/layout/HeaderMenus";
import { getAvatarUrl } from "@/features/avatar/services/avatar";
import { profilePath } from "@/features/social/utils/post-rules";
import { canPickPersonalColor } from "@/features/theme/services/theme-queries";
import { requireUser } from "@/services/auth-guard";

// Trainee account actions shown in the app header: the gear menu (theme, push)
// and the avatar menu (profile, photo, change password, log out).
export const UserHeaderActions = async () => {
  const user = await requireUser();

  return (
    <HeaderMenus
      role="user"
      name={user.name}
      avatarUrl={await getAvatarUrl("user", user.id)}
      canPickAppColor={await canPickPersonalColor("user")}
      profileHref={profilePath("user", user.id)}
    />
  );
};
