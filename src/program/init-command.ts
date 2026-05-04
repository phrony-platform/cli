import path from "node:path";
import type { Command } from "commander";
import { runInit, printInitSuccess } from "../commands/init.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerInitCommand(program: Command): void {
  const init = program
    .command("init")
    .description("Create manifests/, phrony.config.json, and starter files")
    .option("--force", "overwrite existing starter files from init", false);
  addGlobalFlags(init);
  init.action(function initAction(this: Command) {
    const g = this.optsWithGlobals() as GlobalCliOptions & { force?: boolean };
    const cwd = path.resolve(g.cwd);
    try {
      const result = runInit({
        cwd,
        json: Boolean(g.json),
        force: Boolean(g.force),
      });
      if (g.json) {
        console.log(
          JSON.stringify(
            {
              command: "init",
              ok: result.ok,
              files: result.files,
              ...(result.gitignore ? { gitignore: result.gitignore } : {}),
            },
            null,
            2,
          ),
        );
      } else {
        printInitSuccess(cwd, result);
      }
      if (!result.ok) {
        process.exitCode = 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (g.json) {
        console.log(JSON.stringify({ command: "init", ok: false, error: msg }));
      } else {
        console.error(msg);
      }
      process.exitCode = 1;
    }
  });
}
