export const EXERCISE_NAME_MAX = 80;
export const EXERCISE_EQUIPMENT_MAX = 40;
export const EXERCISE_INSTRUCTIONS_MAX = 2000;
// Custom exercises one admin can keep.
export const EXERCISE_CUSTOM_MAX = 500;

export const SEARCH_QUERY_MAX = 100;
export const SEARCH_LIMIT_DEFAULT = 30;
export const SEARCH_LIMIT_MAX = 100;

// Custom photo: the browser resizes to this long side and aims below the
// target; the server refuses anything over the hard limit.
export const PHOTO_MAX_SIDE = 800;
export const PHOTO_TARGET_BYTES = 150 * 1024;
export const PHOTO_MAX_BYTES = 200 * 1024;
// base64 is 4/3 larger, plus the data URL prefix.
export const PHOTO_MAX_DATA_URL_LENGTH =
  Math.ceil((PHOTO_MAX_BYTES * 4) / 3) + 64;
