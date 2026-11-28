// Built-in photos stay on the free-exercise-db repository (Unlicense) and are
// loaded by the browser with a lazy <img>; nothing is copied into this app.
export const CATALOG_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export const catalogImageUrl = (path: string | null) =>
  path ? `${CATALOG_IMAGE_BASE}/${path}` : null;
