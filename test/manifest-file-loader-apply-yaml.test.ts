import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadMergedManifestYamlString } from "../src/lib/manifest-file-loader.js";

const minimalManifest = `kind: phrony.manifest
version: 1
metadata:
  rootManifestKey: agent1
agents:
  - manifestKey: agent1
    name: Agent One
    executionMode: request
    llmProviderName: openai
versions:
  - agentManifestKey: agent1
    status: testing
    versionLabel: v1
    llmModel: gpt-4o-mini
    inputSchema:
      z_last: 1
      a_first: 2
`;

describe("loadMergedManifestYamlString", () => {
  it("returns original file bytes when the entry has no manifest index (preserves YAML map key order)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phrony-apply-yaml-"));
    const p = path.join(root, "export.yaml");
    writeFileSync(p, `${minimalManifest}\n`, "utf8");
    const out = loadMergedManifestYamlString(p);
    expect(out).toBe(minimalManifest.trim());
    const z = out.indexOf("z_last:");
    const a = out.indexOf("a_first:");
    expect(z).toBeGreaterThan(-1);
    expect(a).toBeGreaterThan(-1);
    expect(z).toBeLessThan(a);
  });

  it("re-encodes when the entry uses phrony.manifest.index so includes are merged", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phrony-apply-yaml-"));
    const part = path.join(root, "part.yaml");
    writeFileSync(
      part,
      `kind: phrony.manifest
version: 1
metadata:
  rootManifestKey: agent1
agents:
  - manifestKey: agent1
    name: Agent One
    executionMode: request
    llmProviderName: openai
`,
      "utf8",
    );
    const indexPath = path.join(root, "index.yaml");
    writeFileSync(
      indexPath,
      `kind: phrony.manifest.index
version: 1
includes:
  - part.yaml
`,
      "utf8",
    );
    const out = loadMergedManifestYamlString(indexPath);
    expect(out).toContain("manifestKey: agent1");
    expect(out).not.toContain("phrony.manifest.index");
    expect(out).toContain("kind: phrony.manifest");
  });
});
