// Server messages are Vietnamese; the same strings live in the `errors`
// namespace (group "chatGroups") so every locale gets its own text.
export const GROUP_MESSAGES = {
  GROUP_NOT_FOUND: "Không tìm thấy nhóm chat này",
  INVALID_INPUT: "Thông tin nhóm không hợp lệ",
  NAME_INVALID: "Tên nhóm cần từ 1 đến 60 ký tự",
  MANAGERS_ONLY: "Nhóm này chỉ cho quản lý nhắn tin",
  GROUP_FULL: "Nhóm đã đủ 50 thành viên",
  NOT_MANAGER: "Bạn không quản lý được nhóm này",
  MANAGER_CANNOT_LEAVE: "Quản lý tổng không thể rời nhóm",
  MEMBER_NOT_FOUND: "Không tìm thấy thành viên này trong nhóm",
  CANNOT_REMOVE_MANAGER: "Không thể xoá quản lý tổng khỏi nhóm",
  ALERT_NOT_FOUND: "Không tìm thấy cảnh báo này",
  ALERT_HANDLED: "Cảnh báo này đã được xử lý",
} as const;

export const GROUP_API_ERRORS = {
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "not_found",
  INVALID_QUERY: "invalid_query",
  FORBIDDEN: "forbidden",
} as const;
