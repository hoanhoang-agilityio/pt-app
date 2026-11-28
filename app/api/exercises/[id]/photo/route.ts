import { type NextRequest, NextResponse } from "next/server";

import { findExercisePhoto } from "@/features/exercise-library/services/exercise-queries";
import { exerciseIdSchema } from "@/features/exercise-library/services/exercise-schemas";
import { getApiAdmin } from "@/services/auth-guard";

type Context = { params: Promise<{ id: string }> };

const reply = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

// GET: the photo of one custom exercise. Admins only, and only their own
// exercises: someone else's id answers 404, like a missing one. The URL carries
// `?v=<updatedAt>`, so the bytes of a URL never change and may be cached.
export const GET = async (_request: NextRequest, { params }: Context) => {
  const id = exerciseIdSchema.safeParse(Number((await params).id));

  if (!id.success) {
    return reply({ error: "not_found" }, 404);
  }
  const admin = await getApiAdmin();

  if (!admin) {
    return reply({ error: "unauthorized" }, 401);
  }
  const photo = await findExercisePhoto(admin.id, id.data);

  if (!photo) {
    return reply({ error: "not_found" }, 404);
  }
  return new NextResponse(new Uint8Array(photo.data), {
    status: 200,
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
};
