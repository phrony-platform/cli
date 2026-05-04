import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
  sourcemap: true,
  dts: false,
});
