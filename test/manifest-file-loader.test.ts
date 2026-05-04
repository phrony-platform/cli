import path from "node:path";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  loadPhronyManifestFromFile,
  resolveManifestIncludeFile,
  resolveManifestEntryFile,
} from "../src/lib/manifest-file-loader.js";

function fixtureDir(): string {
  return mkdtempSync(path.join(tmpdir(), "phrony-cli-test-"));
}

describe("resolveManifestIncludeFile", () => {
  it("rejects parent-directory escapes", () => {
    const base = path.join(fixtureDir(), "nested");
    mkdirSync(base, { recursive: true });
    expect(resolveManifestIncludeFile(base, "../x.yaml")).toBeNull();
  });

  it("resolves an existing relative file", () => {
    const root = fixtureDir();
    const child = path.join(root, "child.yaml");
    writeFileSync(child, "x");
    expect(resolveManifestIncludeFile(root, "./child.yaml")).toBe(child);
  });
});

describe("loadPhronyManifestFromFile", () => {
  it("merges index file includes from disk", () => {
    const root = fixtureDir();
    writeFileSync(
      path.join(root, "index.yaml"),
      `kind: phrony.manifest.index
version: 1
includes:
  - "./part.yaml"
`,
    );
    writeFileSync(
      path.join(root, "part.yaml"),
      `kind: phrony.manifest
version: 1
`,
    );
    const doc = loadPhronyManifestFromFile(path.join(root, "index.yaml"));
    expect(doc.kind).toBe("phrony.manifest");
    expect(doc.version).toBe(1);
  });

  it("merges multiple documents in one file", () => {
    const root = fixtureDir();
    writeFileSync(
      path.join(root, "multi.yaml"),
      `kind: phrony.manifest
version: 1
agents: []
---
kind: phrony.manifest
version: 1
llmProviders:
  - name: p1
    type: openai
`,
    );
    const doc = loadPhronyManifestFromFile(path.join(root, "multi.yaml"));
    expect(doc.llmProviders?.map((p) => p.name)).toContain("p1");
  });

  it("reports YAML syntax errors with path:line:column", () => {
    const root = fixtureDir();
    const f = path.join(root, "bad.yaml");
    writeFileSync(f, "[unclosed\n");
    expect(() => loadPhronyManifestFromFile(f)).toThrow(/:\d+:\d+: YAML:/);
  });

  it("reports Zod validation errors with path:line:column", () => {
    const root = fixtureDir();
    const f = path.join(root, "zod.yaml");
    writeFileSync(
      f,
      `kind: phrony.manifest
version: 1
llmProviders:
  - name: x
    type: not_a_real_provider
`,
    );
    expect(() => loadPhronyManifestFromFile(f)).toThrow(/:\d+:\d+:/);
  });

  it("rejects missing file include with a clear error", () => {
    const root = fixtureDir();
    writeFileSync(
      path.join(root, "index.yaml"),
      `kind: phrony.manifest.index
version: 1
includes:
  - "./missing.yaml"
`,
    );
    expect(() => loadPhronyManifestFromFile(path.join(root, "index.yaml"))).toThrow(
      /include file not found/,
    );
  });

  it("resolves directory to index.yaml", () => {
    const root = fixtureDir();
    mkdirSync(path.join(root, "nested"), { recursive: true });
    writeFileSync(
      path.join(root, "nested", "index.yaml"),
      `kind: phrony.manifest
version: 1
`,
    );
    expect(resolveManifestEntryFile(root, "nested")).toBe(path.join(root, "nested", "index.yaml"));
  });

  it("detects include cycles", () => {
    const root = fixtureDir();
    writeFileSync(
      path.join(root, "a.yaml"),
      `kind: phrony.manifest.index
version: 1
includes:
  - "./b.yaml"
`,
    );
    writeFileSync(
      path.join(root, "b.yaml"),
      `kind: phrony.manifest.index
version: 1
includes:
  - "./a.yaml"
`,
    );
    expect(() => loadPhronyManifestFromFile(path.join(root, "a.yaml"))).toThrow(/cycle/);
  });
});