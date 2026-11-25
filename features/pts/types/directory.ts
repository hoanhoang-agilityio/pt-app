export type DirectoryFilter = "all" | "pt" | "trainee" | "unassigned";

export interface DirectoryAdmin {
  id: number;
  username: string;
  role: "super_admin" | "pt";
  verified: boolean;
  traineeCount: number;
}

export interface DirectoryTrainee {
  id: number;
  name: string;
  email: string | null;
  ptAdminId: number | null;
}

export interface DirectoryGroup {
  // PT account id; null for the "Chưa có PT" group.
  ptId: number | null;
  title: string;
  trainees: DirectoryTrainee[];
}

export interface DirectoryView {
  admins: DirectoryAdmin[];
  groups: DirectoryGroup[];
  // True when the search or filter left nothing to show.
  isEmpty: boolean;
}
