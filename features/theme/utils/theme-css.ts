import { normalizeHex } from "./color";
import { deriveDarkVariant, pickForeground } from "./contrast";

// The override style for :root, with the same selectors as app/globals.css
// (light, the system dark media query, and a forced dark theme). Returns null
// for anything that is not a valid color, and only ever interpolates values
// derived from the normalized "#rrggbb", never the raw input.
export const buildThemeCss = (accent: string | null | undefined) => {
  const light = normalizeHex(accent);

  if (!light) {
    return null;
  }
  const lightFg = pickForeground(light);
  const dark = deriveDarkVariant(light);
  const darkFg = pickForeground(dark);
  const darkBlock = `--accent:${dark};--accent-fg:${darkFg};--chart-weight:${dark};`;

  return [
    `:root{--accent:${light};--accent-fg:${lightFg};--chart-weight:${light};}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not([data-theme="dark"]){${darkBlock}}}`,
    `:root[data-theme="dark"]{${darkBlock}}`,
  ].join("\n");
};
