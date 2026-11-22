// Regenerates the app icon, adaptive icon and splash images from one vector
// mark (the dumbbell of the web PWA icon, apps/web/public/icons/icon.svg).
// Needs `sharp`, which is not an app dependency:
//   NODE_PATH=<a node_modules folder that contains sharp> node scripts/generate-brand-assets.mjs
import { Buffer } from "node:buffer";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const out = join(fileURLToPath(new URL(".", import.meta.url)), "..", "assets", "images");

mkdirSync(out, { recursive: true });

const DARK = "#0c0c0e";
const ACCENT = "#e8590c";
const ACCENT_DARK = "#ff7a2e";

// The dumbbell on the 512 grid of the web icon.
const mark = (fill) => `
  <g fill="${fill}">
    <rect x="156" y="238" width="200" height="36" rx="8"/>
    <rect x="118" y="178" width="40" height="156" rx="12"/>
    <rect x="354" y="178" width="40" height="156" rx="12"/>
    <rect x="80" y="208" width="34" height="96" rx="10"/>
    <rect x="398" y="208" width="34" height="96" rx="10"/>
  </g>`;

// `scale` shrinks the mark around the centre (adaptive icons keep a safe zone).
const svg = ({ size, background, fill, scale = 1 }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  ${background ? `<rect width="512" height="512" fill="${background}"/>` : ""}
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark(fill)}</g>
</svg>`;

const png = (name, options) =>
  sharp(Buffer.from(svg(options))).png().toFile(join(out, name));

await Promise.all([
  // iOS / store icon: opaque, no transparency.
  png("icon.png", { size: 1024, background: DARK, fill: "#ffffff", scale: 1.1 }),
  // Android adaptive icon: the system masks the outer third.
  png("android-icon-foreground.png", { size: 512, fill: "#ffffff", scale: 0.78 }),
  png("android-icon-background.png", { size: 512, background: DARK, fill: "none" }),
  png("android-icon-monochrome.png", { size: 432, fill: "#ffffff", scale: 0.78 }),
  // Splash mark on transparent; the plugin paints the background colour.
  png("splash-icon.png", { size: 512, fill: ACCENT, scale: 1.2 }),
  png("splash-icon-dark.png", { size: 512, fill: ACCENT_DARK, scale: 1.2 }),
]);
console.log("Brand assets written to", out);
