import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig({
  ...config,
  testMatch: "editor-style.spec.ts",
  outputDir: "../../node_modules/.cache/editor-style-browser-results",
});
