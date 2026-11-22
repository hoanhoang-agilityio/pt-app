import {
  type AdminLoginRequest,
  adminLoginRequestSchema,
  authTokenResponseSchema,
  meResponseSchema,
  sessionListResponseSchema,
  type UserLoginRequest,
  userLoginRequestSchema,
} from "@pt/contracts";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { api } from "@/lib/api";

// Login, bootstrap, refresh and devices: typed with the @pt/contracts schemas.

// What every client sends on login so "signed-in devices" can name it.
export const clientContext = () => ({
  clientKind: Platform.OS === "ios" ? ("ios" as const) : ("android" as const),
  clientName: (Constants.deviceName ?? `PT App (${Platform.OS})`).slice(0, 100),
});

export const loginTrainee = (email: string, password: string) => {
  const body: UserLoginRequest = userLoginRequestSchema.parse({
    email,
    password,
    ...clientContext(),
  });

  return api.post("/v1/auth/login", {
    body,
    schema: authTokenResponseSchema,
    anonymous: true,
  });
};

export const loginAdmin = (username: string, password: string) => {
  const body: AdminLoginRequest = adminLoginRequestSchema.parse({
    username,
    password,
    ...clientContext(),
  });

  return api.post("/v1/auth/admin/login", {
    body,
    schema: authTokenResponseSchema,
    anonymous: true,
  });
};

export const fetchMe = () => api.get("/v1/auth/me", { schema: meResponseSchema });

// Rotates the token: the old one stops working at once.
export const refreshSession = () =>
  api.post("/v1/auth/refresh", { schema: authTokenResponseSchema });

export const logoutSession = () => api.post("/v1/auth/logout");

export const fetchSessions = () =>
  api.get("/v1/auth/sessions", { schema: sessionListResponseSchema });

export const revokeSession = (id: string) =>
  api.delete(`/v1/auth/sessions/${id}`);

export const saveLocale = (locale: string) =>
  api.put("/v1/me/locale", { body: { locale } });
