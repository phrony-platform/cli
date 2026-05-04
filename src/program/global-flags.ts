import { Command } from "commander";

export type GlobalCliOptions = {
  cwd: string;
  profile?: string;
  debug: boolean;
  json: boolean;
};

/** Commander only parses parent options before the subcommand unless they are re-declared on the leaf command. */
export function addGlobalFlags(cmd: Command): void {
  cmd
    .option("--cwd <dir>", "working directory", process.cwd())
    .option("--profile <name>", "credentials profile (~/.phrony/credentials)")
    .option("--debug", "verbose diagnostics on stderr (secrets redacted)", false)
    .option("--json", "machine-readable output on stdout where supported", false);
}
