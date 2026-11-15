import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "icon-picker.spec.ts",
  workers: 2,
  reporter: "list",
  outputDir: "../../node_modules/.cache/icon-picker-browser-results",
  use: { baseURL: "http://localhost:3076", reducedMotion: "reduce", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { browserName: "chromium", viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    cwd: resolve(__dirname, "../.."),
    command: "pnpm exec vite --config tests/browser/icon-picker.vite.config.mts",
    url: "http://localhost:3076/tests/browser/icon-picker.html",
    reuseExistingServer: false,
  },
});
