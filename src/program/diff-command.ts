import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runDiff } from "../commands/diff.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";
import { MANIFEST_PATH_ARG, MANIFEST_PATH_DEFAULT } from "./manifest-args.js";

export function registerDiffCommand(program: Command): void {
  const diff = program
    .command("diff")
    .argument(MANIFEST_PATH_ARG, "local manifest entry file or directory", MANIFEST_PATH_DEFAULT)
    .description(
      "Read-only structural diff: local manifest vs exported subtree (not an apply preview; remote-only rows are not deletions)",
    )
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)")
    .option("--agent <uuid>", "root agent id for export (overrides PHRONY_ROOT_AGENT_ID / config)");
  addGlobalFlags(diff);
  diff.action(async function diffAction(this: Command, manifestPath: string) {
    const g = this.optsWithGlobals() as GlobalCliOptions & { tenant?: string; agent?: string };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runDiff({
      cwd: process.cwd(),
      manifestPath,
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      agentId: g.agent,
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });
}
