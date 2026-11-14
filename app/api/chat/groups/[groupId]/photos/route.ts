import type { NextRequest } from "next/server";

import {
  checkPhoto,
  PHOTO_ERRORS,
  PHOTO_MAX_BYTES,
} from "@/features/chat/utils/photo-rules";
import {
  loadGroupActor,
  resolveSendBlock,
} from "@/features/chat-groups/services/group-access";
import {
  getApiGroupSession,
  groupJson,
  isSameOrigin,
  notFound,
  parseIdParam,
  type RouteParams,
  unauthorized,
} from "@/features/chat-groups/services/group-api";
import { createPendingGroupPhoto } from "@/features/chat-groups/services/group-photos";
import { localizeResult } from "@/services/localize-message";
import { logServerError } from "@/services/logger";

const reply = async (body: unknown, status: number) =>
  groupJson(await localizeResult(body), status);

const tooLarge = () =>
  reply({ error: "too_large", message: PHOTO_ERRORS.TOO_LARGE }, 413);

// POST: the raw image bytes (the browser already resized and re-encoded
// them). The group and the uploader come from the session and the membership
// check; the photo stays pending until the send action attaches it.
export const POST = async (
  request: NextRequest,
  { params }: RouteParams<"groupId">,
) => {
  if (!isSameOrigin(request)) {
    return reply({ error: "forbidden" }, 403);
  }
  const caller = await getApiGroupSession(request);

  if (!caller) {
    return unauthorized();
  }
  const groupId = parseIdParam((await params).groupId);
  const context = groupId
    ? await loadGroupActor(groupId, caller.session)
    : null;

  if (!context) {
    return notFound();
  }
  // Same rules as sending: chat off, restricted and managers-only refuse.
  const block = await resolveSendBlock({ ...context, user: caller.user });

  if (block) {
    return reply({ error: block.reason, message: block.message }, 403);
  }
  const declared = Number(request.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > PHOTO_MAX_BYTES) {
    return tooLarge();
  }
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    const check = checkPhoto(bytes);

    if (!check.ok) {
      return check.error === "too_large"
        ? tooLarge()
        : reply({ error: "bad_image", message: PHOTO_ERRORS.BAD_IMAGE }, 400);
    }
    const id = await createPendingGroupPhoto({
      groupId: context.group.id,
      uploaderKey: context.actor.key,
      mime: check.mime,
      width: check.width,
      height: check.height,
      bytes,
    });

    return reply({ photo: { id } }, 201);
  } catch (error) {
    logServerError("uploadGroupPhoto", error);
    return reply({ error: "failed", message: PHOTO_ERRORS.GENERIC }, 500);
  }
};
