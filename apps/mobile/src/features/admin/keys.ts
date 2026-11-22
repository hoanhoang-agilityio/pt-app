// TanStack Query keys of the admin screens. Everything starts with "admin" so
// one call can refresh the lot.

export const ak = {
  all: ["admin"] as const,
  dashboard: (week: string, pt: string) => ["admin", "dashboard", week, pt] as const,
  activity: ["admin", "activity"] as const,
  trainees: (q: string, pt: number | null) => ["admin", "trainees", q, pt] as const,
  traineesAll: ["admin", "trainees"] as const,
  trainee: (id: number) => ["admin", "trainee", id] as const,
  traineeActivity: (id: number) => ["admin", "trainee", id, "activity"] as const,
  traineeProgress: (id: number, week: string) => ["admin", "trainee", id, "progress", week] as const,
  restriction: (id: number) => ["admin", "trainee", id, "restriction"] as const,
  workoutWeek: (id: number, week: string) => ["admin", "trainee", id, "workouts", week] as const,
  workoutCopyInfo: (id: number, from: string) => ["admin", "trainee", id, "workout-copy", from] as const,
  nutrition: (id: number, week: string) => ["admin", "trainee", id, "nutrition", week] as const,
  mealPlan: (id: number, week: string) => ["admin", "trainee", id, "meal-plan", week] as const,
  mealCopyInfo: (id: number, from: string) => ["admin", "trainee", id, "meal-copy", from] as const,
  foods: (q: string, group: string) => ["admin", "foods", q, group] as const,
  foodsAll: ["admin", "foods"] as const,
  foodGroups: ["admin", "food-groups"] as const,
  food: (id: number) => ["admin", "food", id] as const,
  pts: ["admin", "pts"] as const,
  me: ["admin", "me"] as const,
  hidden: ["admin", "hidden"] as const,
  dm: ["admin", "dm"] as const,
};
