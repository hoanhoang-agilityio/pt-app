export const ROUTES = {
  HOME: "/",
  WORKOUTS: "/workouts",
  NUTRITION: "/nutrition",
  SUMMARY: "/summary",
  FOODS: "/foods",
  ADMIN: "/admin",
  ADMIN_LOGIN: "/admin/login",
  ADMIN_USERS: "/admin/users",
  ADMIN_FOODS: "/admin/foods",
  ADMIN_FOODS_NEW: "/admin/foods/new",
  // Route handler that clears a stale session cookie, see app/session/end.
  SESSION_END: "/session/end",
} as const;

export const ADMIN_PREVIEW_SEGMENT = "preview";
export const ADMIN_NUTRITION_SEGMENT = "nutrition";
export const ADMIN_SUMMARY_SEGMENT = "summary";
export const SESSION_ROLE_PARAM = "role";
