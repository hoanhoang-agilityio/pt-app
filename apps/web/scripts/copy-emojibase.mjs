import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Self-hosts the emoji data that frimousse (components/EmojiPicker) fetches at
// runtime, so the picker never calls a third-party CDN. Copies data.json and
// messages.json of the app's locales (vi, en, zh) from the emojibase-data
// package into public/emojibase/<locale>/ (about 2.2 MB, git-ignored).
// Runs from the predev and prebuild scripts.
const LOCALES = ["vi", "en", "zh"];
const FILES = ["data.json", "messages.json"];

const require = createRequire(import.meta.url);
const sourceRoot = dirname(require.resolve("emojibase-data/package.json"));
const targetRoot = resolve(process.cwd(), "public/emojibase");

await rm(targetRoot, { recursive: true, force: true });

for (const locale of LOCALES) {
  await mkdir(resolve(targetRoot, locale), { recursive: true });
  for (const file of FILES) {
    await cp(
      resolve(sourceRoot, locale, file),
      resolve(targetRoot, locale, file),
    );
  }
}
