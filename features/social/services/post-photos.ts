import "server-only";

import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { socialPostPhotos, socialPosts } from "@/db/schema";
import { PHOTO_PENDING_TTL_MS } from "@/features/chat/utils/photo-rules";
import { loadVisibilityContext } from "@/features/social/services/post-context";
import type {
  PostAuthorRef,
  PostPhotoView,
  SocialActor,
} from "@/features/social/types/social";
import { socialPhotoUrl } from "@/features/social/utils/post-rules";
import { canSeePost } from "@/features/social/utils/visibility";
import { canAdminAccessUser } from "@/services/hidden-users";

// Photos of posts: storage and access. The uploader comes from the session.

export const uploaderKeyOf = (who: PostAuthorRef) => `${who.kind}:${who.id}`;

// Uploads that never became a post are dropped when the next upload arrives.
const purgeStalePending = (now: Date) =>
  db
    .delete(socialPostPhotos)
    .where(
      and(
        isNull(socialPostPhotos.postId),
        lt(
          socialPostPhotos.createdAt,
          new Date(now.getTime() - PHOTO_PENDING_TTL_MS),
        ),
      ),
    );

export const createPendingPostPhoto = async (
  input: {
    uploaderKey: string;
    mime: "image/webp" | "image/jpeg" | "image/png";
    width: number;
    height: number;
    bytes: Uint8Array;
  },
  now = new Date(),
) => {
  await purgeStalePending(now);
  const [row] = await db
    .insert(socialPostPhotos)
    .values({
      uploaderKey: input.uploaderKey,
      mime: input.mime,
      width: input.width,
      height: input.height,
      data: Buffer.from(input.bytes),
      size: input.bytes.length,
      createdAt: now,
    })
    .returning({ id: socialPostPhotos.id });

  return row.id;
};

// The photo bytes, only when the photo belongs to a live post the viewer may
// see (canSeePost). A pending upload or a deleted post is visible to no one.
export const findPostPhotoForViewer = async (
  photoId: number,
  viewer: SocialActor,
) => {
  const [row] = await db
    .select({
      mime: socialPostPhotos.mime,
      data: socialPostPhotos.data,
      authorKind: socialPosts.authorKind,
      authorId: socialPosts.authorId,
      privacy: socialPosts.privacy,
    })
    .from(socialPostPhotos)
    .innerJoin(socialPosts, eq(socialPosts.id, socialPostPhotos.postId))
    .where(and(eq(socialPostPhotos.id, photoId), isNull(socialPosts.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }
  const ctx = await loadVisibilityContext(viewer, {
    kind: row.authorKind,
    id: row.authorId,
  });
  const post = {
    kind: row.authorKind,
    id: row.authorId,
    privacy: row.privacy,
  };

  if (!canSeePost(viewer, post, ctx)) {
    return null;
  }
  // Same rule as loadVisiblePost: an admin sees a trainee's photo only when
  // that trainee is in their scope (PT workspace, hidden trainees).
  if (
    viewer.kind === "admin" &&
    row.authorKind === "user" &&
    !(await canAdminAccessUser(viewer.id, row.authorId))
  ) {
    return null;
  }
  return { mime: row.mime, data: row.data };
};

// The photos of many posts in one query, in display order (position, then id;
// a null position counts as 0). A post from before several photos has its one
// photo here too, even if only `photoId` points at it. No bytes are read.
export const loadPhotosOfPosts = async (
  posts: { id: number; photoId: number | null }[],
): Promise<Map<number, PostPhotoView[]>> => {
  const result = new Map<number, PostPhotoView[]>();

  if (posts.length === 0) {
    return result;
  }
  const coverIds = posts.flatMap((post) =>
    post.photoId === null ? [] : [post.photoId],
  );
  const rows = await db
    .select({
      id: socialPostPhotos.id,
      postId: socialPostPhotos.postId,
      width: socialPostPhotos.width,
      height: socialPostPhotos.height,
    })
    .from(socialPostPhotos)
    .where(
      or(
        inArray(
          socialPostPhotos.postId,
          posts.map((post) => post.id),
        ),
        coverIds.length > 0
          ? inArray(socialPostPhotos.id, coverIds)
          : undefined,
      ),
    )
    .orderBy(
      asc(sql`coalesce(${socialPostPhotos.position}, 0)`),
      asc(socialPostPhotos.id),
    );
  const coverOf = new Map(posts.map((post) => [post.photoId, post.id]));
  const seen = new Set<number>();

  for (const row of rows) {
    const postId = row.postId ?? coverOf.get(row.id);

    if (postId === undefined || seen.has(row.id) || !row.width) {
      continue;
    }
    seen.add(row.id);
    const list = result.get(postId) ?? [];

    list.push({
      id: row.id,
      url: socialPhotoUrl(row.id),
      width: row.width,
      height: row.height,
    });
    result.set(postId, list);
  }
  return result;
};
