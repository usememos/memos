import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "drawing.spec.ts",
  workers: 1,
  reporter: "list",
  outputDir: "../../node_modules/.cache/drawing-browser-results",
  use: { baseURL: "http://localhost:3074", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { browserName: "chromium", viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    cwd: resolve(__dirname, "../.."),
    command: "pnpm exec vite --config tests/browser/vite.config.mts",
    url: "http://localhost:3074/tests/browser/drawing.html",
    reuseExistingServer: false,
  },
});
