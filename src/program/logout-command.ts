import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runLogout } from "../commands/logout.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerLogoutCommand(program: Command): void {
  const logout = program
    .command("logout")
    .description("Remove saved OAuth tokens (same as `phrony profile logout`)");
  addGlobalFlags(logout);
  logout.action(function logoutAction(this: Command) {
    const g = this.optsWithGlobals() as GlobalCliOptions;
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = runLogout({
      cwd: process.cwd(),
      profile: g.profile,
      json: Boolean(g.json),
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });
}
