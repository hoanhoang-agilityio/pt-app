import {
  EXERCISE_NAME_MAX,
  NOTE_MAX_ITEMS,
  NOTE_TEXT_MAX,
  NOTE_TITLE_MAX,
  SET_NOTE_MAX,
  SETS_PER_ITEM_MAX,
} from "@/features/training-notes/constants/limits";

// Vietnamese in code like the other features; the `errors.trainingNotes`
// namespace holds the same strings for en and zh.
export const TRAINING_NOTE_MESSAGES = {
  DATE_INVALID: "Chọn ngày tập hợp lệ",
  TITLE_TOO_LONG: `Tên buổi tập tối đa ${NOTE_TITLE_MAX} ký tự`,
  NOTE_TOO_LONG: `Ghi chú tối đa ${NOTE_TEXT_MAX} ký tự`,
  TOO_MANY_ITEMS: `Tối đa ${NOTE_MAX_ITEMS} bài tập mỗi ghi chú`,
  EXERCISE_NAME_TOO_LONG: `Tên bài tập tối đa ${EXERCISE_NAME_MAX} ký tự`,
  EXERCISE_NAME_REQUIRED: "Nhập tên bài tập",
  REPS_OR_DURATION: "Chọn rep hoặc số giây, không chọn cả hai",
  EMPTY: "Thêm ít nhất một bài tập hoặc một dòng ghi chú",
  REPS_RANGE: "Rep là số từ 1 đến 99",
  TOO_MANY_SETS: `Tối đa ${SETS_PER_ITEM_MAX} set mỗi bài tập`,
  SET_NOTE_TOO_LONG: `Ghi chú set tối đa ${SET_NOTE_MAX} ký tự`,
  DURATION_RANGE: "Số giây từ 1 đến 3600",
  WEIGHT_RANGE: "Kg từ 0 đến 500",
  NOT_FOUND: "Không tìm thấy ghi chú này",
  SAVED: "Đã lưu ghi chú",
  DELETED: "Đã xóa ghi chú",
} as const;
