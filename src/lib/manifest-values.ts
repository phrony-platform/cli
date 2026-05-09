import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

const VALUES_ENV = "PHRONY_MANIFEST_VALUES";

export function resolveManifestValuesPath(
  cwd: string,
  explicitPath: string | undefined,
  manifestEntryDir: string,
): string | null {
  if (explicitPath != null && explicitPath.trim() !== "") {
    const abs = path.isAbsolute(explicitPath) ? explicitPath : path.resolve(cwd, explicitPath);
    if (!existsSync(abs)) {
      throw new Error(`manifest values file not found: ${abs}`);
    }
    return abs;
  }
  const fromEnv = process.env[VALUES_ENV]?.trim();
  if (fromEnv) {
    const abs = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(cwd, fromEnv);
    if (!existsSync(abs)) {
      throw new Error(`${VALUES_ENV} points to a missing file: ${abs}`);
    }
    return abs;
  }
  for (const name of ["phrony.values.yaml", "phrony.values.yml"]) {
    const abs = path.join(manifestEntryDir, name);
    if (existsSync(abs)) {
      return abs;
    }
  }
  return null;
}

export function loadManifestValuesInputs(valuesFilePath: string): Record<string, string> {
  const text = readFileSync(valuesFilePath, "utf8");
  const doc = parseDocument(text, { merge: false, uniqueKeys: true });
  const js = doc.toJS({ merge: false, uniqueKeys: true });
  if (!js || typeof js !== "object" || Array.isArray(js)) {
    throw new Error(`${valuesFilePath}: values file must be a YAML mapping`);
  }
  const o = js as Record<string, unknown>;
  if (o.version !== 1) {
    throw new Error(`${valuesFilePath}: expected version: 1`);
  }
  const inputs = o.inputs;
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    throw new Error(`${valuesFilePath}: expected inputs: mapping of string keys to scalar values`);
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs as Record<string, unknown>)) {
    if (v === null || v === undefined) {
      continue;
    }
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

/**
 * Loads `phrony.values.yaml` / `phrony.values.yml` beside the manifest entry, or a path from
 * `--values` / `PHRONY_MANIFEST_VALUES`.
 */
export function loadMergedManifestValuesInputs(
  cwd: string,
  manifestEntryPath: string,
  valuesFlag: string | undefined,
): Record<string, string> {
  const manifestEntryDir = path.dirname(path.resolve(manifestEntryPath));
  const vp = resolveManifestValuesPath(cwd, valuesFlag, manifestEntryDir);
  if (!vp) {
    return {};
  }
  return loadManifestValuesInputs(vp);
}
