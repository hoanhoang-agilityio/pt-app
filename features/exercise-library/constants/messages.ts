import {
  EXERCISE_EQUIPMENT_MAX,
  EXERCISE_INSTRUCTIONS_MAX,
  EXERCISE_NAME_MAX,
} from "@/features/exercise-library/constants/limits";

// Vietnamese in code like the other features; the `errors.exerciseLibrary`
// namespace holds the same strings for en and zh.
export const EXERCISE_MESSAGES = {
  NAME_REQUIRED: "Nhập tên bài tập",
  NAME_TOO_LONG: `Tên bài tập tối đa ${EXERCISE_NAME_MAX} ký tự`,
  EQUIPMENT_TOO_LONG: `Dụng cụ tối đa ${EXERCISE_EQUIPMENT_MAX} ký tự`,
  INSTRUCTIONS_TOO_LONG: `Hướng dẫn tối đa ${EXERCISE_INSTRUCTIONS_MAX} ký tự`,
  MUSCLE_INVALID: "Nhóm cơ không hợp lệ",
  INVALID_INPUT: "Dữ liệu không hợp lệ",
  NOT_FOUND: "Không tìm thấy bài tập",
  PHOTO_INVALID: "Ảnh không hợp lệ. Chọn ảnh JPEG, PNG hoặc WebP.",
  PHOTO_TOO_LARGE: "Ảnh quá lớn. Chọn ảnh khác.",
  TOO_MANY: "Đã đạt số bài tập tự tạo tối đa",
} as const;
