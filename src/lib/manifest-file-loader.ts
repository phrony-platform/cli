import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { LineCounter, parseAllDocuments, stringify, type Document } from "yaml";
import type { ZodError } from "zod";
import {
  PhronyManifestDocumentV1Schema,
  PhronyManifestIndexV1Schema,
} from "../schema/manifest-document.schemas.js";
import type { PhronyManifestDocumentV1 } from "../schema/manifest-document.schemas.js";
import type { PhronyManifestV1 } from "../schema/manifest-document.schemas.js";
import { mergePhronyManifestDocuments } from "../schema/manifest-yaml.js";

const YAML_PARSE_OPTIONS = { merge: false, uniqueKeys: true } as const;

const MAX_INCLUDE_DEPTH = 32;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isIndexDoc(v: unknown): boolean {
  return (
    isPlainObject(v) &&
    v.kind === "phrony.manifest.index" &&
    v.version === 1 &&
    Array.isArray(v.includes)
  );
}

function formatPathLineCol(filePath: string, lc: LineCounter, offset: number): string {
  const { line, col } = lc.linePos(offset);
  return `${filePath}:${line}:${col}`;
}

function formatZodIssues(filePath: string, lc: LineCounter, docStartOffset: number, err: ZodError): string {
  const loc = formatPathLineCol(filePath, lc, docStartOffset);
  const detail = err.errors
    .map((e) => {
      const p = e.path.length ? e.path.map(String).join(".") : "(root)";
      return `${p}: ${e.message}`;
    })
    .join("; ");
  return `${loc}: ${detail}`;
}

function assertNoYamlDocErrors(filePath: string, lc: LineCounter, d: Document): void {
  const base = d.range?.[0] ?? 0;
  for (const err of d.errors) {
    const pos = err.pos?.[0] ?? base;
    throw new Error(`${formatPathLineCol(filePath, lc, pos)}: YAML: ${err.message}`);
  }
}

function looksLikeMissingFileInclude(trimmed: string): boolean {
  if (trimmed.startsWith(`..${path.sep}`) || trimmed === ".." || trimmed.startsWith("../")) {
    return true;
  }
  if (trimmed.startsWith("..\\")) {
    return true;
  }
  if (trimmed.startsWith(`.${path.sep}`) || trimmed.startsWith("./") || trimmed.startsWith(".\\")) {
    return true;
  }
  return /\.ya?ml$/i.test(trimmed);
}

/**
 * Resolve `include` as a readable file under `baseDir`, or return null to treat it as inline YAML.
 */
export function resolveManifestIncludeFile(baseDir: string, include: string): string | null {
  const trimmed = include.trim();
  if (trimmed.includes("\n")) {
    return null;
  }
  if (path.isAbsolute(trimmed)) {
    return null;
  }
  const baseResolved = path.resolve(baseDir);
  const candidate = path.resolve(baseDir, trimmed);
  const rel = path.relative(baseResolved, candidate);
  if (rel === "" || rel.startsWith(`..${path.sep}`) || rel === "..") {
    return null;
  }
  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    return null;
  }
  return candidate;
}

function classifyInclude(
  baseDir: string,
  include: string,
): { mode: "file"; absPath: string } | { mode: "inline" } | { mode: "reject-absolute" } {
  const trimmed = include.trim();
  if (trimmed.includes("\n")) {
    return { mode: "inline" };
  }
  if (path.isAbsolute(trimmed)) {
    return { mode: "reject-absolute" };
  }
  const child = resolveManifestIncludeFile(baseDir, trimmed);
  if (child) {
    return { mode: "file", absPath: child };
  }
  if (looksLikeMissingFileInclude(trimmed)) {
    const baseResolved = path.resolve(baseDir);
    const candidate = path.resolve(baseDir, trimmed);
    const rel = path.relative(baseResolved, candidate);
    if (rel.startsWith(`..${path.sep}`) || rel === "..") {
      throw new Error(
        `${path.join(baseDir, trimmed)}: manifest include must not escape the manifest directory (${trimmed})`,
      );
    }
    throw new Error(
      `${path.join(baseDir, trimmed)}: manifest include file not found or not a file (${trimmed})`,
    );
  }
  return { mode: "inline" };
}

function collectFromInlineYaml(
  yamlText: string,
  visitingAbsolutePaths: Set<string>,
  depth: number,
  label: string,
  resolveBaseDir: string,
  out: PhronyManifestDocumentV1[],
): void {
  if (depth > MAX_INCLUDE_DEPTH) {
    throw new Error(`manifest include depth exceeded (max ${MAX_INCLUDE_DEPTH})`);
  }
  const trimmed = yamlText.trim();
  if (!trimmed) {
    return;
  }
  const lc = new LineCounter();
  const streamDocs = parseAllDocuments(trimmed, { ...YAML_PARSE_OPTIONS, lineCounter: lc });
  for (const d of streamDocs) {
    assertNoYamlDocErrors(label, lc, d);
    const js = d.toJS(YAML_PARSE_OPTIONS);
    if (
      js == null ||
      (typeof js === "object" && !Array.isArray(js) && Object.keys(js as object).length === 0)
    ) {
      continue;
    }
    const docStart = d.range?.[0] ?? 0;
    if (isIndexDoc(js)) {
      const idx = PhronyManifestIndexV1Schema.safeParse(js);
      if (!idx.success) {
        throw new Error(formatZodIssues(label, lc, docStart, idx.error));
      }
      for (const inc of idx.data.includes) {
        collectIncludePayload(label, resolveBaseDir, inc, visitingAbsolutePaths, depth + 1, out);
      }
    } else {
      const parsed = PhronyManifestDocumentV1Schema.safeParse(js);
      if (!parsed.success) {
        throw new Error(formatZodIssues(label, lc, docStart, parsed.error));
      }
      out.push(parsed.data);
    }
  }
}

function collectIncludePayload(
  sourceFileForErrors: string,
  baseDir: string,
  include: string,
  visitingAbsolutePaths: Set<string>,
  depth: number,
  out: PhronyManifestDocumentV1[],
): void {
  const kind = classifyInclude(baseDir, include);
  if (kind.mode === "reject-absolute") {
    throw new Error(`${sourceFileForErrors}: manifest include must be a relative file path or inline YAML`);
  }
  if (kind.mode === "file") {
    collectManifestDocumentsFromFile(kind.absPath, visitingAbsolutePaths, depth, out);
    return;
  }
  collectFromInlineYaml(
    include,
    visitingAbsolutePaths,
    depth,
    `${sourceFileForErrors} (inline include)`,
    baseDir,
    out,
  );
}

function collectManifestDocumentsFromFile(
  filePath: string,
  visitingAbsolutePaths: Set<string>,
  depth: number,
  out: PhronyManifestDocumentV1[],
): void {
  if (depth > MAX_INCLUDE_DEPTH) {
    throw new Error(`manifest include depth exceeded (max ${MAX_INCLUDE_DEPTH})`);
  }
  const resolved = path.resolve(filePath);
  if (visitingAbsolutePaths.has(resolved)) {
    throw new Error(`manifest include cycle: ${resolved}`);
  }
  visitingAbsolutePaths.add(resolved);
  try {
    const text = readFileSync(resolved, "utf8");
    const baseDir = path.dirname(resolved);
    const lc = new LineCounter();
    const streamDocs = parseAllDocuments(text.trim(), { ...YAML_PARSE_OPTIONS, lineCounter: lc });
    for (const d of streamDocs) {
      assertNoYamlDocErrors(resolved, lc, d);
      const js = d.toJS(YAML_PARSE_OPTIONS);
      if (
        js == null ||
        (typeof js === "object" && !Array.isArray(js) && Object.keys(js as object).length === 0)
      ) {
        continue;
      }
      const docStart = d.range?.[0] ?? 0;
      if (isIndexDoc(js)) {
        const idx = PhronyManifestIndexV1Schema.safeParse(js);
        if (!idx.success) {
          throw new Error(formatZodIssues(resolved, lc, docStart, idx.error));
        }
        for (const inc of idx.data.includes) {
          collectIncludePayload(resolved, baseDir, inc, visitingAbsolutePaths, depth + 1, out);
        }
      } else {
        const parsed = PhronyManifestDocumentV1Schema.safeParse(js);
        if (!parsed.success) {
          throw new Error(formatZodIssues(resolved, lc, docStart, parsed.error));
        }
        out.push(parsed.data);
      }
    }
  } finally {
    visitingAbsolutePaths.delete(resolved);
  }
}

/**
 * Expand `phrony.manifest.index` file includes from disk, then parse and validate with Zod.
 * Errors use `path:line:column:` prefixes where the YAML layer provides offsets.
 */
export function loadPhronyManifestFromFile(entryPath: string): PhronyManifestV1 {
  const collected: PhronyManifestDocumentV1[] = [];
  collectManifestDocumentsFromFile(path.resolve(entryPath), new Set(), 0, collected);
  return mergePhronyManifestDocuments(collected);
}

/** Merged manifest as YAML text suitable for `POST …/manifest/apply`. */
export function loadMergedManifestYamlString(entryPath: string): string {
  const doc = loadPhronyManifestFromFile(entryPath);
  return stringify(
    { ...doc, kind: "phrony.manifest" },
    { lineWidth: 120, indent: 2, sortMapEntries: false },
  );
}

/** Resolve CLI path argument to a concrete manifest entry file. */
export function resolveManifestEntryFile(cwd: string, target: string): string {
  const abs = path.resolve(cwd, target);
  const st = statSync(abs);
  if (st.isFile()) {
    return abs;
  }
  if (st.isDirectory()) {
    const indexYaml = path.join(abs, "index.yaml");
    if (existsSync(indexYaml) && statSync(indexYaml).isFile()) {
      return indexYaml;
    }
    const indexYml = path.join(abs, "index.yml");
    if (existsSync(indexYml) && statSync(indexYml).isFile()) {
      return indexYml;
    }
  }
  throw new Error(
    `manifest path must be a YAML file, or a directory containing index.yaml / index.yml (got ${abs})`,
  );
}
