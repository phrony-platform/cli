import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";

export type InitOptions = {
  cwd: string;
  json: boolean;
  /** Overwrite manifests/index.yaml, example.yaml, phrony.config.json if they already exist */
  force?: boolean;
};

export type InitResult = {
  ok: boolean;
  files: string[];
  /** Set when `.gitignore` was created or appended with Phrony entries */
  gitignore?: "created" | "appended";
};

export function runInit(opts: InitOptions): InitResult {
  const manifestsDir = path.join(opts.cwd, "manifests");
  mkdirSync(manifestsDir, { recursive: true });

  const indexYaml = `kind: phrony.manifest.index
version: 1
includes:
  - "./example.yaml"
`;

  const exampleManifest = `kind: phrony.manifest
version: 1
metadata:
  label: example
llmProviders:
  - name: openai
    type: openai
agents:
  - manifestKey: example_root
    name: Example root agent
    executionMode: request
    llmProviderName: openai
versions:
  - agentManifestKey: example_root
    status: testing
    versionLabel: v1
    llmModel: gpt-4o-mini
`;

  const configJson = {
    tenantId: "",
    apiBase: "https://api.phrony.com",
    rootAgentId: "",
    defaultProfile: "default",
  };

  const files: string[] = [];
  const pIndex = path.join(manifestsDir, "index.yaml");
  const pEx = path.join(manifestsDir, "example.yaml");
  const pJson = path.join(opts.cwd, "phrony.config.json");

  if (!opts.force) {
    for (const p of [pIndex, pEx, pJson]) {
      if (existsSync(p)) {
        throw new Error(`refusing to overwrite existing file (use --force): ${p}`);
      }
    }
  }

  writeFileSync(pIndex, indexYaml);
  files.push(pIndex);
  writeFileSync(pEx, exampleManifest);
  files.push(pEx);
  writeFileSync(pJson, `${JSON.stringify(configJson, null, 2)}\n`);
  files.push(pJson);

  const gitignore = path.join(opts.cwd, ".gitignore");
  let gi = "";
  const hadGitignore = existsSync(gitignore);
  if (hadGitignore) {
    gi = readFileSync(gitignore, "utf8");
  }
  const add: string[] = [];
  if (!gi.includes(".env")) {
    add.push(".env");
  }
  if (!gi.includes(".phrony/")) {
    add.push(".phrony/");
  }
  let gitignoreChange: InitResult["gitignore"];
  if (add.length) {
    const block = `${gi.length && !gi.endsWith("\n") ? "\n" : ""}\n# Phrony CLI\n${add.join("\n")}\n`;
    if (hadGitignore) {
      writeFileSync(gitignore, block, { flag: "a" });
      gitignoreChange = "appended";
    } else {
      writeFileSync(gitignore, block.replace(/^\n+/, ""), "utf8");
      gitignoreChange = "created";
    }
    files.push(gitignore);
  }

  return { ok: true, files, ...(gitignoreChange ? { gitignore: gitignoreChange } : {}) };
}

/** Human-readable summary after a successful `phrony init` (non-`--json`). */
export function printInitSuccess(cwd: string, result: InitResult): void {
  const rel = (abs: string) => path.relative(cwd, abs) || abs;
  const giPath = path.join(cwd, ".gitignore");
  const coreFiles = result.files.filter((f) => f !== giPath);

  console.log("");
  console.log(`${pc.green("✓")} ${pc.bold("Phrony manifest project initialized")}`);
  console.log(pc.dim(`  ${cwd}`));
  console.log("");
  console.log(pc.bold("Created"));
  for (const f of coreFiles) {
    console.log(`  ${pc.green("+")} ${rel(f)}`);
  }
  if (result.gitignore === "appended") {
    console.log(`  ${pc.yellow("+")} ${rel(giPath)} ${pc.dim("(appended .env and .phrony/)")}`);
  } else if (result.gitignore === "created") {
    console.log(`  ${pc.green("+")} ${rel(giPath)}`);
  }

  console.log("");
  console.log(pc.bold("Next steps"));
  console.log(`  ${pc.dim("1.")} Set ${pc.cyan("tenantId")} (and ${pc.cyan("apiBase")} if needed) in ${pc.cyan("phrony.config.json")}.`);
  console.log(`  ${pc.dim("2.")} Run ${pc.cyan("phrony login")} or set ${pc.cyan("PHRONY_ACCESS_TOKEN")} (CI) for plan, apply, and diff.`);
  console.log(`  ${pc.dim("3.")} Run ${pc.cyan("phrony lint")} to validate your manifests.`);
  console.log("");
}
