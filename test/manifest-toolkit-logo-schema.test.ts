import { describe, expect, it } from "vitest";
import { parsePhronyManifestYaml } from "../src/schema/manifest-yaml.js";

describe("manifest service config", () => {
  it("drops toolkitLogo from service config (dashboard-only; not in manifest contract)", () => {
    const yaml = `kind: phrony.manifest
version: 1
services:
  - name: Telegram
    type: built_in
    config:
      toolkitLogo: https://example.com/logo.png?t=1
      toolkitSlug: telegram
      authScheme: API_KEY
`;
    const doc = parsePhronyManifestYaml(yaml);
    const cfg = doc.services?.[0]?.config as Record<string, unknown> | undefined;
    expect(cfg).toBeDefined();
    expect(cfg!.toolkitLogo).toBeUndefined();
    expect(cfg!.toolkitSlug).toBe("telegram");
  });
});
