import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import {
  runAgentVersionDeploy,
  runAgentVersionGet,
  runAgentVersionLs,
  runAgentVersionRetract,
} from "../commands/agent-version.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { parseSkipTakeCli } from "../lib/parse-skip-take-cli.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerAgentVersionCommands(agentCmd: Command): void {
  const versionCmd = agentCmd
    .command("version")
    .description("List, inspect, deploy, and retract versions for an agent");
  addGlobalFlags(versionCmd);

  const versionLs = versionCmd
    .command("ls")
    .argument("<agentId>", "agent UUID")
    .description("List versions for an agent (newest first)")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)")
    .option("--skip <n>", "pagination offset (non-negative integer)")
    .option("--take <n>", "page size (positive integer; server caps at 100)");
  addGlobalFlags(versionLs);
  versionLs.action(async function versionLsAction(this: Command, agentId: string) {
    const g = this.optsWithGlobals() as GlobalCliOptions & {
      tenant?: string;
      skip?: string;
      take?: string;
    };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const parsed = parseSkipTakeCli({ skip: g.skip, take: g.take });
    if (!parsed.ok) {
      if (g.json) {
        console.log(
          JSON.stringify({
            command: "agent version ls",
            ok: false,
            error: "error",
            message: parsed.message,
          }),
        );
      } else {
        console.error(parsed.message);
      }
      process.exitCode = 1;
      return;
    }
    const { ok, exitCode } = await runAgentVersionLs({
      cwd: process.cwd(),
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      agentId: agentId.trim(),
      skip: parsed.skip,
      take: parsed.take,
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });

  const versionGet = versionCmd
    .command("get")
    .argument("<agentId>", "agent UUID")
    .argument("<versionId>", "agent version UUID")
    .description("Fetch one agent version as JSON (--json wraps stdout for scripts)")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)");
  addGlobalFlags(versionGet);
  versionGet.action(async function versionGetAction(this: Command, agentId: string, versionId: string) {
    const g = this.optsWithGlobals() as GlobalCliOptions & { tenant?: string };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runAgentVersionGet({
      cwd: process.cwd(),
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      agentId: agentId.trim(),
      versionId: versionId.trim(),
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });

  const versionDeploy = versionCmd
    .command("deploy")
    .argument("<agentId>", "agent UUID")
    .argument("<versionId>", "agent version UUID to deploy")
    .description("Deploy a version (requires agents:write)")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)");
  addGlobalFlags(versionDeploy);
  versionDeploy.action(async function versionDeployAction(
    this: Command,
    agentId: string,
    versionId: string,
  ) {
    const g = this.optsWithGlobals() as GlobalCliOptions & { tenant?: string };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runAgentVersionDeploy({
      cwd: process.cwd(),
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      agentId: agentId.trim(),
      versionId: versionId.trim(),
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });

  const versionRetract = versionCmd
    .command("retract")
    .argument("<agentId>", "agent UUID")
    .argument("<versionId>", "deployed version UUID to retract")
    .description("Retract a deployed version (requires agents:write)")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)");
  addGlobalFlags(versionRetract);
  versionRetract.action(async function versionRetractAction(
    this: Command,
    agentId: string,
    versionId: string,
  ) {
    const g = this.optsWithGlobals() as GlobalCliOptions & { tenant?: string };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runAgentVersionRetract({
      cwd: process.cwd(),
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      agentId: agentId.trim(),
      versionId: versionId.trim(),
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });
}
