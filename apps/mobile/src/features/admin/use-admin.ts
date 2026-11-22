import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import { fetchPts } from "./api";
import { ak } from "./keys";

// The signed-in admin, or null for a trainee / signed-out state.
export const useAdminActor = () => {
  const { state } = useAuth();

  return state.status === "signedIn" && state.me.actor.kind === "admin" ? state.me.actor : null;
};

export const useIsSuperAdmin = () => useAdminActor()?.role === "super_admin";

// PT accounts, for the filters and the PT picker (super admin only).
export const usePts = () => {
  const isSuper = useIsSuperAdmin();

  return useQuery({ queryKey: ak.pts, queryFn: fetchPts, enabled: isSuper });
};
