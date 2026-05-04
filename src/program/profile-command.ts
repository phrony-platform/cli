import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runLogout } from "../commands/logout.js";
import { runProfileLs } from "../commands/profile-ls.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerProfileCommand(program: Command): void {
  const profileCmd = program
    .command("profile")
    .description("List credentials profiles and clear OAuth sessions in ~/.phrony/credentials");
  addGlobalFlags(profileCmd);

  const profileLs = profileCmd
    .command("ls")
    .description("List profiles (OAuth / stored access token flags; no secrets printed)");
  addGlobalFlags(profileLs);
  profileLs.action(function profileLsAction(this: Command) {
    const g = this.optsWithGlobals() as GlobalCliOptions;
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = runProfileLs({
      cwd: process.cwd(),
      profile: g.profile,
      json: Boolean(g.json),
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });

  const profileLogout = profileCmd
    .command("logout")
    .description("Remove saved OAuth tokens for the selected profile");
  addGlobalFlags(profileLogout);
  profileLogout.action(function profileLogoutAction(this: Command) {
    const g = this.optsWithGlobals() as GlobalCliOptions;
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = runLogout({
      cwd: process.cwd(),
      profile: g.profile,
      json: Boolean(g.json),
      debug,
      jsonCommand: "profile logout",
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });
}
