import path from "node:path";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runInit } from "../src/commands/init.js";

describe("runInit", () => {
  it("writes manifests, config, and optional .gitignore entries", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phrony-init-"));
    const { ok, files } = runInit({ cwd: root, json: false });
    expect(ok).toBe(true);
    expect(files.some((f) => f.endsWith("manifests/index.yaml"))).toBe(true);
    expect(existsSync(path.join(root, "phrony.config.json"))).toBe(true);
    const idx = readFileSync(path.join(root, "manifests", "index.yaml"), "utf8");
    expect(idx).toContain("phrony.manifest.index");
  });

  it("refuses to overwrite without --force", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phrony-init-"));
    runInit({ cwd: root, json: false });
    expect(() => runInit({ cwd: root, json: false })).toThrow(/refusing to overwrite/);
  });

  it("appends .gitignore without duplicating existing content", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phrony-init-"));
    const gi = path.join(root, ".gitignore");
    writeFileSync(gi, "legacy-line\n", "utf8");
    runInit({ cwd: root, json: false, force: false });
    const text = readFileSync(gi, "utf8");
    expect(text).toContain("legacy-line");
    expect(text.match(/legacy-line/g)?.length).toBe(1);
    expect((text.match(/# Phrony CLI/g) ?? []).length).toBe(1);
  });

  it("second run with --force does not duplicate the Phrony gitignore banner", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phrony-init-"));
    runInit({ cwd: root, json: false });
    runInit({ cwd: root, json: false, force: true });
    const text = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect((text.match(/# Phrony CLI/g) ?? []).length).toBe(1);
  });
});
