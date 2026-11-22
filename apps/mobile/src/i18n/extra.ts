import enMessenger from "./locales/en/messenger.json";
import enSocial from "./locales/en/social.json";
import viMessenger from "./locales/vi/messenger.json";
import viSocial from "./locales/vi/social.json";
import zhMessenger from "./locales/zh/messenger.json";
import zhSocial from "./locales/zh/social.json";

// Strings of the social and messenger extras (friends, blocks, reports,
// aliases, group management, chat info). Kept in their own files per feature
// and merged on top of vi.json / en.json / zh.json.
export const extraVi = { ...viSocial, ...viMessenger };
export const extraEn = { ...enSocial, ...enMessenger };
export const extraZh = { ...zhSocial, ...zhMessenger };
