import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runPlan } from "../commands/plan.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";
import { MANIFEST_PATH_ARG, MANIFEST_PATH_DEFAULT } from "./manifest-args.js";

export function registerPlanCommand(program: Command): void {
  const plan = program
    .command("plan")
    .argument(MANIFEST_PATH_ARG, "manifest entry file or directory", MANIFEST_PATH_DEFAULT)
    .description("Dry-run manifest apply (OAuth or PHRONY_ACCESS_TOKEN)")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)")
    .option("--prune", "pass prune=true to apply", false)
    .option("--name-suffix <s>", "optional nameSuffix query param")
    .option("--anchor-agent <uuid>", "optional anchorAgentId query param")
    .option("--values <path>", "path to phrony.values.yaml (overrides PHRONY_MANIFEST_VALUES)");
  addGlobalFlags(plan);
  plan.action(async function planAction(this: Command, manifestPath: string) {
    const g = this.optsWithGlobals() as GlobalCliOptions & {
      tenant?: string;
      prune?: boolean;
      nameSuffix?: string;
      anchorAgent?: string;
      values?: string;
    };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runPlan({
      cwd: process.cwd(),
      manifestPath,
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      prune: Boolean(g.prune),
      nameSuffix: g.nameSuffix,
      anchorAgentId: g.anchorAgent,
      valuesPath: g.values,
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });
}
