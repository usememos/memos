import config from "../../vite.config.mjs";

export default {
  ...config,
  cacheDir: "node_modules/.vite-icon-picker-test",
  server: { ...config.server, port: 3076, strictPort: true, hmr: false },
};
