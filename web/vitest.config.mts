import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Vitest configuration. Kept separate from `vite.config.mts` so the dev/build
// pipelines stay lean and so tests can opt into jsdom + @testing-library
// without dragging them into production bundles.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Keep in sync with the `@/` alias declared in `vite.config.mts` so that
    // test-time module resolution matches production/build.
    alias: {
      "@/": `${resolve(__dirname, "src")}/`,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Keep each test hermetic:
    //  - mockReset clears call history and resets implementations for vi.fn()s,
    //    so module-level mocks (e.g. useCurrentUser) don't leak between tests.
    //  - restoreMocks additionally restores original implementations for spies.
    mockReset: true,
    restoreMocks: true,
  },
});
