import { CHAT_PAGE_SIZE } from "@/features/chat/utils/chat-rules";

// Explicit members only (trainees and PTs); super admins are implicit.
export const GROUP_MEMBER_CAP = 50;
export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 60;
export const GROUP_PAGE_SIZE = CHAT_PAGE_SIZE;
