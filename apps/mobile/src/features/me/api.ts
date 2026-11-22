import {
  avatarResponseSchema,
  type ChatColorKey,
  chatColorResponseSchema,
  userProfileResponseSchema,
} from "@pt/contracts";

import { api } from "@/lib/api";

// The trainee's own profile (/v1/users/me, /v1/me/bio, password).

export const fetchMyProfile = () =>
  api.get("/v1/users/me", { schema: userProfileResponseSchema });

// The API takes the photo as a JSON data URL (256 px, at most 80 KB).
export const setAvatar = (dataUrl: string) =>
  api.put("/v1/users/me/avatar", { body: { dataUrl }, schema: avatarResponseSchema });

export const removeAvatar = () =>
  api.delete("/v1/users/me/avatar", { schema: avatarResponseSchema });

export const setChatColor = (color: ChatColorKey | null) =>
  api.put("/v1/users/me/chat-color", {
    body: { color },
    schema: chatColorResponseSchema,
  });

export const setBio = (bio: string) => api.put("/v1/me/bio", { body: { bio } });

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post("/v1/users/me/password", { body: { currentPassword, newPassword } });
