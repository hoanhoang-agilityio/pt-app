import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { admins, socialPostPhotos, socialPosts, users } from "@/db/schema";
import { deleteEngagementOfPosts } from "@/features/social/services/engagement-cleanup";
import { uploaderKeyOf } from "@/features/social/services/post-photos";
import type { PostPrivacy, SocialActor } from "@/features/social/types/social";
import {
  canDeletePost,
  canEditPost,
  isPostEmpty,
  MAX_POST_PHOTOS,
} from "@/features/social/utils/post-rules";

export type PostMutationError =
  "empty" | "not_found" | "forbidden" | "photo_not_found" | "too_many_photos";

type Outcome<T = object> =
  ({ ok: true } & T) | { ok: false; error: PostMutationError };

const failure = (error: PostMutationError) => ({ ok: false as const, error });

export const createPost = async (
  actor: SocialActor,
  input: { caption: string; privacy: PostPrivacy; photoIds: number[] },
  now = new Date(),
): Promise<Outcome<{ postId: number }>> => {
  const caption = input.caption.trim();

  if (isPostEmpty(caption, input.photoIds.length > 0)) {
    return failure("empty");
  }
  if (input.photoIds.length > MAX_POST_PHOTOS) {
    return failure("too_many_photos");
  }
  if (new Set(input.photoIds).size !== input.photoIds.length) {
    return failure("photo_not_found");
  }
  try {
    const postId = await db.transaction(async (tx) => {
      const [post] = await tx
        .insert(socialPosts)
        .values({
          authorKind: actor.kind,
          authorId: actor.id,
          caption: caption === "" ? null : caption,
          privacy: input.privacy,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: socialPosts.id });

      // Only the uploader's own pending photos can be attached, once each; the
      // array order is the display order and the first one is the cover.
      for (const [position, photoId] of input.photoIds.entries()) {
        const attached = await tx
          .update(socialPostPhotos)
          .set({ postId: post.id, position })
          .where(
            and(
              eq(socialPostPhotos.id, photoId),
              eq(socialPostPhotos.uploaderKey, uploaderKeyOf(actor)),
              isNull(socialPostPhotos.postId),
            ),
          )
          .returning({ id: socialPostPhotos.id });

        if (attached.length === 0) {
          throw new PhotoNotFoundError();
        }
      }
      if (input.photoIds.length > 0) {
        await tx
          .update(socialPosts)
          .set({ photoId: input.photoIds[0] })
          .where(eq(socialPosts.id, post.id));
      }
      if (actor.kind === "user") {
        await tx
          .update(users)
          .set({ postPrivacyDefault: input.privacy })
          .where(eq(users.id, actor.id));
      }
      return post.id;
    });

    return { ok: true, postId };
  } catch (error) {
    if (error instanceof PhotoNotFoundError) {
      return failure("photo_not_found");
    }
    throw error;
  }
};

class PhotoNotFoundError extends Error {}

const findLivePost = async (postId: number) => {
  const [post] = await db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.id, postId), isNull(socialPosts.deletedAt)))
    .limit(1);

  return post ?? null;
};

// The author changes caption and privacy, not the photo (spec R2).
export const editPost = async (
  actor: SocialActor,
  input: { postId: number; caption: string; privacy: PostPrivacy },
  now = new Date(),
): Promise<Outcome> => {
  const post = await findLivePost(input.postId);

  if (!post) {
    return failure("not_found");
  }
  if (!canEditPost(actor, { kind: post.authorKind, id: post.authorId })) {
    return failure("forbidden");
  }
  const caption = input.caption.trim();

  if (isPostEmpty(caption, post.photoId !== null)) {
    return failure("empty");
  }
  await db
    .update(socialPosts)
    .set({
      caption: caption === "" ? null : caption,
      privacy: input.privacy,
      updatedAt: now,
    })
    .where(eq(socialPosts.id, post.id));
  return { ok: true };
};

// The author deletes their post; a super admin deletes any. The photo bytes go
// with it.
export const deletePost = async (
  actor: SocialActor,
  postId: number,
  now = new Date(),
): Promise<Outcome> => {
  const post = await findLivePost(postId);

  if (!post) {
    return failure("not_found");
  }
  if (!canDeletePost(actor, { kind: post.authorKind, id: post.authorId })) {
    return failure("forbidden");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(socialPosts)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(socialPosts.id, post.id));
    await tx
      .delete(socialPostPhotos)
      .where(eq(socialPostPhotos.postId, post.id));
    await deleteEngagementOfPosts(tx, [post.id]);
  });
  return { ok: true };
};

export const updateBio = async (actor: SocialActor, bio: string) => {
  const value = bio.trim() === "" ? null : bio.trim();

  if (actor.kind === "user") {
    await db.update(users).set({ bio: value }).where(eq(users.id, actor.id));
  } else {
    await db.update(admins).set({ bio: value }).where(eq(admins.id, actor.id));
  }
};
