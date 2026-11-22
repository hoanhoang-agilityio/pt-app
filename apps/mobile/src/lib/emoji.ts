// Is a string exactly one emoji? The API accepts any single emoji as a
// reaction, so the app checks the same before it sends one. Hermes has no
// Intl.Segmenter, so this walks code points instead: a base (pictographic,
// regional-indicator pair or keycap) with optional variation selector, skin
// tone and ZWJ-joined parts.

export const REACTION_BAR = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;
export const EMOJI_MAX_LENGTH = 32;

const inRanges = (code: number, ranges: readonly (readonly [number, number])[]) =>
  ranges.some(([from, to]) => code >= from && code <= to);

const PICTOGRAPHIC = [
  [0x00a9, 0x00a9],
  [0x00ae, 0x00ae],
  [0x203c, 0x203c],
  [0x2049, 0x2049],
  [0x2122, 0x2122],
  [0x2139, 0x2139],
  [0x2194, 0x21aa],
  [0x231a, 0x23ff],
  [0x24c2, 0x24c2],
  [0x25aa, 0x25fe],
  [0x2600, 0x27bf],
  [0x2934, 0x2935],
  [0x2b05, 0x2b55],
  [0x3030, 0x3030],
  [0x303d, 0x303d],
  [0x3297, 0x3299],
  [0x1f000, 0x1faff],
] as const;

const REGIONAL = [[0x1f1e6, 0x1f1ff]] as const;
const SKIN_TONE = [[0x1f3fb, 0x1f3ff]] as const;
const VS16 = 0xfe0f;
const ZWJ = 0x200d;
const KEYCAP = 0x20e3;

const isPictographic = (code: number) =>
  inRanges(code, PICTOGRAPHIC) &&
  !inRanges(code, REGIONAL) &&
  !inRanges(code, SKIN_TONE);

export const isSingleEmoji = (value: string) => {
  if (value.length === 0 || value.length > EMOJI_MAX_LENGTH) {
    return false;
  }
  const codes = Array.from(value, (char) => char.codePointAt(0) as number);
  let index = 0;

  // Keycap: [0-9#*] VS16? U+20E3
  if (/^[0-9#*]$/.test(String.fromCodePoint(codes[0]))) {
    const rest = codes.slice(1);

    return (
      (rest.length === 1 && rest[0] === KEYCAP) ||
      (rest.length === 2 && rest[0] === VS16 && rest[1] === KEYCAP)
    );
  }
  // Flag: two regional indicators.
  if (inRanges(codes[0], REGIONAL)) {
    return codes.length === 2 && inRanges(codes[1], REGIONAL);
  }
  const part = () => {
    if (index >= codes.length || !isPictographic(codes[index])) {
      return false;
    }
    index += 1;
    if (codes[index] === VS16) {
      index += 1;
    }
    if (index < codes.length && inRanges(codes[index], SKIN_TONE)) {
      index += 1;
    }
    return true;
  };

  if (!part()) {
    return false;
  }
  while (index < codes.length) {
    if (codes[index] !== ZWJ) {
      return false;
    }
    index += 1;
    if (!part()) {
      return false;
    }
  }
  return true;
};

// Emoji of the "+" grid, grouped; enough for a simple picker.
export const EMOJI_GRID = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉", "😊", "😇",
  "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "🤗", "🤔", "🤨", "😐",
  "😏", "😒", "🙄", "😬", "😮", "😯", "😲", "😳", "🥺", "😢", "😭", "😤",
  "😠", "😡", "🤯", "😱", "😴", "🤒", "🤕", "🥳", "😎", "🤓", "🫡", "🙏",
  "👍", "👎", "👏", "🙌", "👌", "✌️", "🤞", "🤝", "💪", "🫶", "❤️", "🧡",
  "💛", "💚", "💙", "💜", "🖤", "💔", "🔥", "✨", "🎉", "🏆", "🥇", "🎯",
  "🏃", "🏋️", "🚴", "🧘", "🥗", "🍎", "🍌", "🥑", "🍗", "💧", "☕", "🌞",
] as const;
