import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runLint } from "../commands/lint.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import {
  defaultCredentialsPath,
  loadProfileFromCredentialsFile,
  resolveDefaultProfileName,
} from "../lib/credentials.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerLintCommand(program: Command): void {
  const lint = program
    .command("lint")
    .argument("[path]", "file or directory", "./manifests")
    .description("Validate manifest YAML (Zod) with file includes resolved from disk");
  addGlobalFlags(lint);
  lint.action(async function lintAction(this: Command, target: string) {
    const g = this.optsWithGlobals() as GlobalCliOptions;
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const credPath = defaultCredentialsPath();
    const profile = g.profile ?? resolveDefaultProfileName(credPath) ?? "default";
    const fromFile = loadProfileFromCredentialsFile(credPath, profile);
    debug(`lint: profile=${profile} resolved=${Boolean(fromFile)} cwd=${g.cwd}`);
    const { ok, errors } = runLint({
      cwd: process.cwd(),
      target,
      json: Boolean(g.json),
      debug,
    });
    if (g.json) {
      console.log(JSON.stringify({ command: "lint", ok, errors }, null, 2));
    } else if (!ok) {
      for (const line of errors) {
        console.error(line);
      }
    }
    if (!ok) {
      process.exitCode = 1;
    }
  });
}
