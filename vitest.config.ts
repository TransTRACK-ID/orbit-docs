import vue from "@vitejs/plugin-vue";
import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "#imports": path.resolve(__dirname, "./vitest-imports-mock.ts"),
      "~": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    // Local git clones cloned for doc generation (gitignored scratch) are
    // not this repo's tests.
    exclude: [...configDefaults.exclude, "orbit-docs-repositories/**"],
    coverage: {
      include: ["utils/**/*.{js,ts}", "composables/**/*.{js,ts}"],
    },
    globals: true,
  },
});
