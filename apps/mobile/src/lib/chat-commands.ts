// Slash commands of the chat composer, the same as the web
// (features/chat/utils/chat-commands.ts). Pure.

export type ChatCommandEffects = {
  // Store and publish the message as usual, but send no push notification.
  silent?: boolean;
};

export type ChatCommand = {
  name: string;
  effects: ChatCommandEffects;
};

export const CHAT_COMMANDS: readonly ChatCommand[] = [
  { name: "imlang", effects: { silent: true } },
];

const COMMAND_PREFIX = /^\/([A-Za-z]+)(?=\s|$)\s*/;

const findCommand = (name: string) =>
  CHAT_COMMANDS.find((command) => command.name === name.toLowerCase()) ?? null;

export type ParsedChatCommand = {
  body: string;
  command: ChatCommand | null;
  effects: ChatCommandEffects;
};

// Only a leading `/<name>` followed by whitespace or the end counts. The
// prefix and the whitespace after it are stripped; anything else is plain text.
export const parseChatCommand = (text: string): ParsedChatCommand => {
  const match = COMMAND_PREFIX.exec(text);
  const command = match ? findCommand(match[1]) : null;

  if (!match || !command) {
    return { body: text.trim(), command: null, effects: {} };
  }
  return {
    body: text.slice(match[0].length).trim(),
    command,
    effects: command.effects,
  };
};

// Commands whose `/name` starts with what is typed, while the name is still
// being typed (`/` plus letters, no whitespace yet).
export const matchCommandSuggestions = (text: string): ChatCommand[] => {
  if (!/^\/[A-Za-z]*$/.test(text)) {
    return [];
  }
  const typed = text.slice(1).toLowerCase();

  return CHAT_COMMANDS.filter((command) => command.name.startsWith(typed));
};
