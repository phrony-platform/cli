#!/usr/bin/env node
import { buildProgram } from "./program.js";

/**
 * `process.argv.slice(2)` is always arguments **after** `node <script>` (never includes the
 * script path). For `phrony <command>` / `node dist/cli.mjs <command>`, that slice is already
 * `[ "<command>", … ]`.
 *
 * `pnpm run dev -- …` runs `tsx src/cli.ts -- …` and pnpm forwards a literal `--` as the
 * first of those args (`argv[2]`). Commander then stops option parsing, so flags like `--cwd`
 * become spurious positionals. Drop that single leading `--` when present.
 */
function userArgs(argv: typeof process.argv): string[] {
  const tail = argv.slice(2);
  return tail[0] === "--" ? tail.slice(1) : tail;
}

await buildProgram().parseAsync(userArgs(process.argv), { from: "user" });
