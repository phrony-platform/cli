import { Command } from "commander";
import { registerAgentCommand } from "./program/agent-command.js";
import { registerApplyCommand } from "./program/apply-command.js";
import { registerDiffCommand } from "./program/diff-command.js";
import { addGlobalFlags } from "./program/global-flags.js";
import { registerInitCommand } from "./program/init-command.js";
import { registerLintCommand } from "./program/lint-command.js";
import { registerLoginCommand } from "./program/login-command.js";
import { registerLogoutCommand } from "./program/logout-command.js";
import { registerPlanCommand } from "./program/plan-command.js";
import { registerProfileCommand } from "./program/profile-command.js";
import { registerVersionCommand } from "./program/version-command.js";

export type { GlobalCliOptions } from "./program/global-flags.js";

export function buildProgram(): Command {
  const program = new Command();
  program.name("phrony").description("Phrony manifest tooling");
  addGlobalFlags(program);

  registerLintCommand(program);
  registerPlanCommand(program);
  registerApplyCommand(program);
  registerDiffCommand(program);
  registerAgentCommand(program);
  registerInitCommand(program);
  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerProfileCommand(program);
  registerVersionCommand(program);

  return program;
}
