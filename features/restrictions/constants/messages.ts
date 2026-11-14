// Vietnamese, like the other message constants: the `errors` namespace maps
// them to the active locale on the way out (see i18n/localize-message.ts).
export const RESTRICTION_MESSAGES = {
  RESTRICTED:
    "Tài khoản của bạn đang bị hạn chế, nên chưa thể thực hiện thao tác này.",
  USER_NOT_FOUND: "Không tìm thấy học viên cần chặn",
  INVALID_INPUT: "Thông tin chặn không hợp lệ",
  REASON_REQUIRED: "Hãy nhập lý do chặn",
  REASON_TOO_LONG: "Lý do chặn tối đa 300 ký tự",
  NOT_RESTRICTED: "Học viên này hiện không bị chặn",
} as const;
