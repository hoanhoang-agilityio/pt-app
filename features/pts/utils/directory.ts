import type {
  DirectoryAdmin,
  DirectoryFilter,
  DirectoryGroup,
  DirectoryTrainee,
  DirectoryView,
} from "@/features/pts/types/directory";
import { toNameKey } from "@/utils/name";

// Accent-free, lower-cased text so "nguyen" finds "Nguyễn".
const fold = (text: string) => toNameKey(text);

export const countByFilter = (
  admins: DirectoryAdmin[],
  trainees: DirectoryTrainee[],
): Record<DirectoryFilter, number> => ({
  all: admins.length + trainees.length,
  pt: admins.filter((admin) => admin.role === "pt").length,
  trainee: trainees.length,
  unassigned: trainees.filter((trainee) => trainee.ptAdminId === null).length,
});

// What the "PT & học viên" page shows for a filter chip and a search text:
// admin accounts first, then trainees grouped by PT, "Chưa có PT" last.
export const buildDirectory = (
  admins: DirectoryAdmin[],
  trainees: DirectoryTrainee[],
  {
    filter,
    query,
    unassignedTitle,
  }: { filter: DirectoryFilter; query: string; unassignedTitle: string },
): DirectoryView => {
  const needle = fold(query);
  const isSearching = needle !== "";
  const matchesAdmin = (admin: DirectoryAdmin) =>
    !isSearching || fold(admin.username).includes(needle);
  const matchesTrainee = (trainee: DirectoryTrainee) =>
    !isSearching ||
    fold(trainee.name).includes(needle) ||
    fold(trainee.email ?? "").includes(needle);

  const shownAdmins = admins.filter((admin) => {
    if (filter === "all") {
      return matchesAdmin(admin);
    }
    return filter === "pt" && admin.role === "pt" && matchesAdmin(admin);
  });

  const shownTrainees =
    filter === "pt"
      ? []
      : trainees.filter(
          (trainee) =>
            (filter !== "unassigned" || trainee.ptAdminId === null) &&
            matchesTrainee(trainee),
        );

  const groups: DirectoryGroup[] = [];

  if (filter !== "unassigned") {
    for (const admin of admins) {
      if (admin.role !== "pt") {
        continue;
      }
      const members = shownTrainees.filter(
        (trainee) => trainee.ptAdminId === admin.id,
      );

      // A PT without trainees keeps its (empty) group only when nothing
      // narrows the list; a search or the Học viên chip hides it.
      if (members.length > 0 || (filter === "all" && !isSearching)) {
        groups.push({
          ptId: admin.id,
          title: admin.username,
          trainees: members,
        });
      }
    }
  }

  const unassigned = shownTrainees.filter(
    (trainee) => trainee.ptAdminId === null,
  );

  // Groups of a PT that no longer exists would hide their trainees: they
  // fall into "Chưa có PT" like trainees without a PT.
  const knownPtIds = new Set(
    admins.filter((admin) => admin.role === "pt").map((admin) => admin.id),
  );
  const orphans = shownTrainees.filter(
    (trainee) =>
      trainee.ptAdminId !== null && !knownPtIds.has(trainee.ptAdminId),
  );
  const lastGroup = [...unassigned, ...orphans];

  if (lastGroup.length > 0 || filter === "unassigned") {
    groups.push({ ptId: null, title: unassignedTitle, trainees: lastGroup });
  }

  return {
    admins: shownAdmins,
    groups,
    isEmpty:
      shownAdmins.length === 0 &&
      groups.every((group) => group.trainees.length === 0) &&
      (isSearching || filter !== "all"),
  };
};
