import {
  contactAliasListResponseSchema,
  contactAliasResponseSchema,
  socialFriendRequestsResponseSchema,
  socialFriendsResponseSchema,
  socialPeopleResponseSchema,
  type SocialReportReasonCode,
  type SocialReportResolution,
  socialReportsResponseSchema,
  type SocialReportTargetKind,
  socialSendFriendRequestResponseSchema,
} from "@pt/contracts";

import { api } from "@/lib/api";

// Friends, blocks, reports and private contact aliases. Friends and blocks are
// trainee-only on the API; the reports queue is for a super admin.

export const searchPeople = (email: string) =>
  api.get("/v1/social/people", { query: { email }, schema: socialPeopleResponseSchema });

export const fetchFriends = () =>
  api.get("/v1/social/friends", { schema: socialFriendsResponseSchema });

export const fetchFriendRequests = () =>
  api.get("/v1/social/friends/requests", { schema: socialFriendRequestsResponseSchema });

export const sendFriendRequest = (userId: number) =>
  api.post("/v1/social/friends/requests", {
    body: { userId },
    schema: socialSendFriendRequestResponseSchema,
  });

export const acceptFriendRequest = (userId: number) =>
  api.post(`/v1/social/friends/requests/${userId}/accept`);

export const declineFriendRequest = (userId: number) =>
  api.post(`/v1/social/friends/requests/${userId}/decline`);

export const cancelFriendRequest = (userId: number) =>
  api.delete(`/v1/social/friends/requests/${userId}`);

export const unfriend = (userId: number) => api.delete(`/v1/social/friends/${userId}`);

export const fetchBlocks = () =>
  api.get("/v1/social/blocks", { schema: socialFriendsResponseSchema });

export const blockUser = (userId: number) => api.put(`/v1/social/blocks/${userId}`);

export const unblockUser = (userId: number) => api.delete(`/v1/social/blocks/${userId}`);

export const fileReport = (input: {
  targetKind: SocialReportTargetKind;
  targetId: number;
  reasonCode?: SocialReportReasonCode;
  reason?: string;
}) => api.post("/v1/social/reports", { body: input });

export const fetchReports = () =>
  api.get("/v1/social/reports", { schema: socialReportsResponseSchema });

export const resolveReport = (id: number, resolution: SocialReportResolution) =>
  api.post(`/v1/social/reports/${id}/resolve`, { body: { resolution } });

// ---- Private contact aliases (what only I call someone) ---------------------

export const fetchAliases = () =>
  api.get("/v1/contact-aliases", { schema: contactAliasListResponseSchema });

export const setAlias = (targetKey: string, alias: string) =>
  api.put(`/v1/contact-aliases/${encodeURIComponent(targetKey)}`, {
    body: { alias },
    schema: contactAliasResponseSchema,
  });

export const clearAlias = (targetKey: string) =>
  api.delete(`/v1/contact-aliases/${encodeURIComponent(targetKey)}`);

// ---- Own bio ----------------------------------------------------------------

export const saveBio = (bio: string) => api.put("/v1/me/bio", { body: { bio } });
