import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runLogin } from "../commands/login.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerLoginCommand(program: Command): void {
  const login = program
    .command("login")
    .description("Sign in with the browser (OAuth2 PKCE) and store tokens in ~/.phrony/credentials")
    .option("--api-base <url>", "gateway origin (overrides PHRONY_API_BASE / phrony.config.json)");
  addGlobalFlags(login);
  login.action(async function loginAction(this: Command) {
    const g = this.optsWithGlobals() as GlobalCliOptions & { apiBase?: string };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runLogin({
      cwd: process.cwd(),
      profile: g.profile,
      json: Boolean(g.json),
      debug,
      apiBase: g.apiBase,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });
}
