// UI copy for the trainee's set logger (KAN-30). Server messages live in
// `messages.ts`.
export const SET_LOGGER_COPY = {
  TITLE: "Ghi hiệp",
  ADD_ROW: "Thêm hiệp",
  SAVE: "Lưu",
  SAVING: "Đang lưu…",
  WEIGHT_PLACEHOLDER: "kg",
  WEIGHT_UNIT: "kg",
  REPS_UNIT: "lần",
  BODYWEIGHT: "Tự trọng",
  BODYWEIGHT_HINT: "Để trống kg nếu tập với trọng lượng cơ thể",
  PERSONAL_BEST: "Kỷ lục mới! 🏆",
  PERSONAL_BEST_BADGE: "Kỷ lục mới",
  HINT_PREFIX: "Lần trước",
  LOGGED_PREFIX: "Đã ghi:",
  NOTHING_LOGGED: "Chưa ghi hiệp nào",
} as const;

export const describeMissingReps = (setNumber: number) =>
  `Nhập số lần cho hiệp ${setNumber}`;

export const describeRowError = (setNumber: number, message: string) =>
  `Hiệp ${setNumber}: ${message}`;

export const describeWeightLabel = (setNumber: number) =>
  `Số kg hiệp ${setNumber}`;

export const describeRepsLabel = (setNumber: number) =>
  `Số lần hiệp ${setNumber}`;

export const describeDeleteLabel = (setNumber: number) =>
  `Xóa hiệp ${setNumber}`;

export const describeHintLabel = (setNumber: number, text: string) =>
  `Dùng số lần trước cho hiệp ${setNumber}: ${text}`;
