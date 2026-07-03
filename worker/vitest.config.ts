import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            // Tests don't need the built frontend; serve a fixture assets dir.
            assets: { directory: "./test/fixtures/assets" },
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
