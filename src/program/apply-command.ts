import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runApply } from "../commands/apply.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";
import { MANIFEST_PATH_ARG, MANIFEST_PATH_DEFAULT } from "./manifest-args.js";

export function registerApplyCommand(program: Command): void {
  const apply = program
    .command("apply")
    .argument(MANIFEST_PATH_ARG, "manifest entry file or directory", MANIFEST_PATH_DEFAULT)
    .description("Plan (dry-run) then apply manifest changes (OAuth or PHRONY_ACCESS_TOKEN)")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)")
    .option("--prune", "pass prune=true to apply", false)
    .option("--name-suffix <s>", "optional nameSuffix query param")
    .option("--anchor-agent <uuid>", "optional anchorAgentId query param")
    .option("--values <path>", "path to phrony.values.yaml (overrides PHRONY_MANIFEST_VALUES)");
  addGlobalFlags(apply);
  apply.action(async function applyAction(this: Command, manifestPath: string) {
    const g = this.optsWithGlobals() as GlobalCliOptions & {
      tenant?: string;
      prune?: boolean;
      nameSuffix?: string;
      anchorAgent?: string;
      autoApprove?: boolean;
      values?: string;
    };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runApply({
      cwd: process.cwd(),
      manifestPath,
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      prune: Boolean(g.prune),
      nameSuffix: g.nameSuffix,
      anchorAgentId: g.anchorAgent,
      autoApprove: Boolean(g.autoApprove),
      valuesPath: g.values,
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });
}
