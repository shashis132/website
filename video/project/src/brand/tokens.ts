// GeniusCFO brand tokens, copied from the website's assets/site.css so the
// videos and the site share one palette. Change them there first, then here.
export const colors = {
  ink: "#0b0f1a",
  ink2: "#141926",
  ink3: "#2a3142",
  inkSoft: "#3d4459",
  paper: "#ffffff",
  ground: "#f3f4f8",
  wash: "#dfe3ee",
  washDeep: "#bcc4da",
  hairline: "#dfe2ea",
  emerald: "#00c896",
  emeraldA: "#00a87c",
  emeraldB: "#00d9a3",
  emeraldText: "#00674d",
  amber: "#ff9f1c",
  coral: "#ff4b6e",
} as const;

export const fonts = {
  display: "IBM Plex Sans Condensed",
  body: "DM Sans",
  mono: "DM Mono",
} as const;

export const gradients = {
  hero: "radial-gradient(92.09% 126.39% at 50% 100%, #dfe3ee 58.91%, #bcc4da 100%)",
  ink: "linear-gradient(to right, #0b0f1a 0%, #3d4459 100%)",
} as const;

export const fontStack = {
  display: `"${fonts.display}", "Arial Narrow", system-ui, sans-serif`,
  body: `"${fonts.body}", -apple-system, "Segoe UI", sans-serif`,
  mono: `"${fonts.mono}", ui-monospace, Consolas, monospace`,
} as const;
