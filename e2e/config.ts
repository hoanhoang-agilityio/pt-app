import { resolve } from "node:path";

// Single source of truth for the e2e database. Everything the e2e touches
// (Next server, drizzle-kit push, seed) gets this URL, never one from the
// shell or `.env.local`.
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_TMP_DIR = resolve(__dirname, ".tmp");
export const E2E_DB_PATH = resolve(E2E_TMP_DIR, "e2e.db");
// Forward slashes so the URL is also valid for libSQL on Windows.
export const E2E_DB_URL = `file:${E2E_DB_PATH.replaceAll("\\", "/")}`;

// services/env.ts prefers the TURSO_* pair, so both pairs are pinned and the
// tokens blanked. Blank values are ignored by readEnv, not used as fallbacks.
export const E2E_ENV = {
  DATABASE_URL: E2E_DB_URL,
  TURSO_DATABASE_URL: E2E_DB_URL,
  DATABASE_AUTH_TOKEN: "",
  TURSO_AUTH_TOKEN: "",
  SESSION_SECRET: "e2e-only-secret-at-least-32-characters-long",
  VERCEL: "",
} as const;

export const E2E_USER_NAME = "E2E Trainee";

// Throwaway admin for the PT specs. It only exists in the scratch DB.
export const E2E_ADMIN = {
  username: "e2e-admin",
  password: "e2e-only-admin-password",
} as const;

// Trainees of the PT specs: one with logged sets, one with nothing logged.
export const E2E_LIFTER_NAME = "E2E Lifter";
export const E2E_EMPTY_NAME = "E2E Empty";
