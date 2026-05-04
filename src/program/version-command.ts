import type { Command } from "commander";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerVersionCommand(program: Command): void {
  const versionCmd = program.command("version").description("Print CLI version");
  addGlobalFlags(versionCmd);
  versionCmd.action(function versionAction(this: Command) {
    const g = this.optsWithGlobals() as GlobalCliOptions;
    const v = process.env.npm_package_version ?? "0.0.1";
    if (g.json) {
      console.log(JSON.stringify({ command: "version", version: v }));
    } else {
      console.log(v);
    }
  });
}
