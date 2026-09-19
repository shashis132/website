import { Config } from "@remotion/cli/config";
import fs from "node:fs";
import path from "node:path";

// The sandbox ships Playwright's browsers. Remotion needs the headless shell,
// not the full Chromium binary (which has dropped old-headless mode).
const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
try {
  const shellDir = fs.readdirSync(pw).find((d) => d.startsWith("chromium_headless_shell-"));
  if (shellDir) {
    const shell = path.join(pw, shellDir, "chrome-linux", "headless_shell");
    if (fs.existsSync(shell)) Config.setBrowserExecutable(shell);
  }
} catch {
  // Not in the sandbox: Remotion downloads its own browser.
}

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPublicDir("./public");
