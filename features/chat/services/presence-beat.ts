import "server-only";

import {
  getAdminTeamLastSeen,
  getUserLastSeen,
  touchAdminPresence,
  touchUserPresence,
} from "@/features/chat/services/presence";
import { serializeLastSeen } from "@/features/chat/utils/presence";
import { issueUnlock } from "@/services/admin-lock";
import { canAdminAccessUser } from "@/services/hidden-users";
import { findUserById } from "@/services/users";

export interface PeerPresence {
  peerLastSeenAt: string | null;
  // The server's clock: last-seen is stamped by it, so "online" must be judged
  // on it too (the client measures its skew from this).
  serverNow: string;
}

const peerPresence = (lastSeenAt: Date | null): PeerPresence => ({
  peerLastSeenAt: serializeLastSeen(lastSeenAt),
  serverNow: new Date().toISOString(),
});

// One heartbeat for a signed-in trainee (the write is throttled to one a
// minute inside the service).
export const beatUser = async (userId: number) => {
  await touchUserPresence(userId);
};

// One heartbeat for a signed-in admin. The caller got `admin` from
// getApiAdmin, which is null while locked, so the unlock only slides an
// existing unlock forward (KAN-160). Admins without a passcode need no cookie.
export const beatAdmin = async (admin: {
  id: number;
  hasPasscode: boolean;
}) => {
  await touchAdminPresence(admin.id);
  if (admin.hasPasscode) {
    await issueUnlock(admin.id);
  }
};

// A trainee's view of the PT team: newest last-seen across all PTs.
export const peerPresenceForUser = async (): Promise<PeerPresence> =>
  peerPresence(await getAdminTeamLastSeen());

// An admin's view of one trainee. Null when the trainee does not exist or this
// admin may not see them (hidden chats): callers decide how to report that.
export const peerPresenceForAdmin = async (
  adminId: number,
  userId: number,
): Promise<PeerPresence | null> => {
  const trainee = await findUserById(userId);

  if (!trainee || !(await canAdminAccessUser(adminId, trainee.id))) {
    return null;
  }
  return peerPresence(await getUserLastSeen(trainee.id));
};

// Several trainees at once for an admin (one entry per accessible id; the
// rest are left out). One serverNow for all.
export const peersForAdmin = async (
  adminId: number,
  userIds: number[],
): Promise<{
  serverNow: string;
  peers: Record<string, { peerLastSeenAt: string | null }>;
}> => {
  const readings = await Promise.all(
    userIds.map(
      async (id) => [id, await peerPresenceForAdmin(adminId, id)] as const,
    ),
  );

  return {
    serverNow: new Date().toISOString(),
    peers: Object.fromEntries(
      readings.flatMap(([id, reading]) =>
        reading
          ? [[String(id), { peerLastSeenAt: reading.peerLastSeenAt }]]
          : [],
      ),
    ),
  };
};
