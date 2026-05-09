import path from "node:path";
import { readdirSync, statSync } from "node:fs";
import pc from "picocolors";
import type { DebugLogger } from "../lib/debug-logger.js";
import { loadPhronyManifestFromFile } from "../lib/manifest-file-loader.js";
import { loadMergedManifestValuesInputs } from "../lib/manifest-values.js";

function isYamlFile(name: string): boolean {
  return name.endsWith(".yaml") || name.endsWith(".yml");
}

function walkYamlFiles(rootDir: string): string[] {
  const out: string[] = [];
  const stack = [path.resolve(rootDir)];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".git") {
          continue;
        }
        stack.push(full);
      } else if (ent.isFile() && isYamlFile(ent.name)) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

export type LintOptions = {
  cwd: string;
  target: string;
  json: boolean;
  debug: DebugLogger;
  valuesPath?: string;
};

export function runLint(opts: LintOptions): { ok: boolean; errors: string[] } {
  const absTarget = path.resolve(opts.cwd, opts.target);
  let stat;
  try {
    stat = statSync(absTarget);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [`cannot access ${absTarget}: ${msg}`] };
  }

  const files: string[] = stat.isDirectory() ? walkYamlFiles(absTarget) : [absTarget];
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push(`no YAML files found under ${absTarget}`);
  }

  for (const file of files) {
    try {
      const inputs = loadMergedManifestValuesInputs(opts.cwd, file, opts.valuesPath);
      loadPhronyManifestFromFile(file, { inputs });
      opts.debug(`lint ok`, { file });
      if (!opts.json) {
        console.log(`${pc.green("ok")}  ${path.relative(opts.cwd, file) || file}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const dup = msg.startsWith(`${file}:`) || msg.startsWith(`${path.resolve(file)}:`);
      const display = dup ? msg : `${path.relative(opts.cwd, file) || file}: ${msg}`;
      errors.push(display);
      if (!opts.json) {
        console.error(`${pc.red("err")} ${display}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
