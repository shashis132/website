import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { fonts } from "./tokens";

// Font files live in public/fonts (copied from the @fontsource packages), so a
// render never depends on the network. loadFont() delays rendering until the
// faces are ready.
const faces: { family: string; weight: string; file: string }[] = [
  { family: fonts.body, weight: "400", file: "dm-sans-latin-400-normal.woff2" },
  { family: fonts.body, weight: "500", file: "dm-sans-latin-500-normal.woff2" },
  { family: fonts.body, weight: "600", file: "dm-sans-latin-600-normal.woff2" },
  { family: fonts.display, weight: "500", file: "ibm-plex-sans-condensed-latin-500-normal.woff2" },
  { family: fonts.display, weight: "600", file: "ibm-plex-sans-condensed-latin-600-normal.woff2" },
  { family: fonts.mono, weight: "400", file: "dm-mono-latin-400-normal.woff2" },
  { family: fonts.mono, weight: "500", file: "dm-mono-latin-500-normal.woff2" },
];

let pending: Promise<void> | null = null;

export const loadBrandFonts = (): Promise<void> => {
  if (!pending) {
    pending = Promise.all(
      faces.map((f) =>
        loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, format: "woff2" }),
      ),
    ).then(() => undefined);
  }
  return pending;
};
