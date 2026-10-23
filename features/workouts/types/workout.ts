export interface Exercise {
  id: number;
  title: string;
  description: string;
  sets: number | null;
  reps: string;
  youtubeId: string;
  position: number;
  // Epoch ms when the user marked it done, or null.
  completedAt: number | null;
}

export interface ExerciseSet {
  id: number;
  exerciseId: number;
  userId: number;
  // 0-based order within the exercise.
  position: number;
  // Kilograms; null means bodyweight.
  weightKg: number | null;
  reps: number;
  createdAt: Date;
}

// A best set always has a weight: bodyweight sets never count (OQ2).
export interface BestSet {
  weightKg: number;
  reps: number;
}

export interface ScheduleDay {
  date: string;
  title: string;
  note: string;
  exercises: Exercise[];
}

export type MoveDirection = "up" | "down";

export interface MemberOption {
  id: number;
  name: string;
}

export interface Progress {
  completed: number;
  total: number;
  percent: number;
}
