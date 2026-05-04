import path from "node:path";
import { chdir } from "node:process";
import type { Command } from "commander";
import { runAgentGet, runAgentLs } from "../commands/agent.js";
import { createDebugLogger } from "../lib/debug-logger.js";
import { parseSkipTakeCli } from "../lib/parse-skip-take-cli.js";
import { registerAgentVersionCommands } from "./agent-version-command.js";
import { addGlobalFlags, type GlobalCliOptions } from "./global-flags.js";

export function registerAgentCommand(program: Command): void {
  const agentCmd = program
    .command("agent")
    .description("Workspace agents: list agents, inspect versions, deploy and retract (OAuth or PHRONY_ACCESS_TOKEN)");
  addGlobalFlags(agentCmd);

  const agentLs = agentCmd
    .command("ls")
    .description("List agents in the workspace")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)")
    .option("--skip <n>", "pagination offset (non-negative integer)")
    .option("--take <n>", "page size (positive integer; server caps at 100)");
  addGlobalFlags(agentLs);
  agentLs.action(async function agentLsAction(this: Command) {
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
        console.log(JSON.stringify({ command: "agent ls", ok: false, error: "error", message: parsed.message }));
      } else {
        console.error(parsed.message);
      }
      process.exitCode = 1;
      return;
    }
    const { ok, exitCode } = await runAgentLs({
      cwd: process.cwd(),
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      skip: parsed.skip,
      take: parsed.take,
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });

  const agentGet = agentCmd
    .command("get")
    .argument("<agentId>", "agent UUID")
    .description("Fetch one agent as JSON (--json wraps stdout for scripts)")
    .option("--tenant <id>", "tenant id (overrides PHRONY_TENANT_ID / phrony.config.json)");
  addGlobalFlags(agentGet);
  agentGet.action(async function agentGetAction(this: Command, agentId: string) {
    const g = this.optsWithGlobals() as GlobalCliOptions & { tenant?: string };
    chdir(path.resolve(g.cwd));
    const debug = createDebugLogger(Boolean(g.debug));
    const { ok, exitCode } = await runAgentGet({
      cwd: process.cwd(),
      json: Boolean(g.json),
      profile: g.profile,
      tenantId: g.tenant,
      agentId: agentId.trim(),
      debug,
    });
    if (!ok) {
      process.exitCode = exitCode;
    }
  });

  registerAgentVersionCommands(agentCmd);
}
