import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveCliAuth } from "../src/lib/resolve-cli-auth.js";

const tenant = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("resolveCliAuth", () => {
  let credFile: string;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers PHRONY_ACCESS_TOKEN", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-auth-"));
    credFile = path.join(dir, "credentials.toml");
    writeFileSync(credFile, "", "utf8");
    vi.stubEnv("PHRONY_CREDENTIALS_FILE", credFile);
    vi.stubEnv("PHRONY_ACCESS_TOKEN", "pwt_testtokenxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    vi.stubEnv("PHRONY_API_KEY", "phk_should_be_ignored");
    vi.stubEnv("PHRONY_TENANT_ID", tenant);
    const r = await resolveCliAuth({ cwd: process.cwd() });
    expect(r).toEqual({
      mode: "access_token",
      accessToken: "pwt_testtokenxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      apiBase: "https://api.phrony.com",
      tenantId: tenant,
      profile: "default",
    });
  });

  it("does not use PHRONY_API_KEY for manifest auth", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-auth-"));
    credFile = path.join(dir, "credentials.toml");
    writeFileSync(credFile, "", "utf8");
    vi.stubEnv("PHRONY_CREDENTIALS_FILE", credFile);
    vi.stubEnv("PHRONY_API_KEY", "phk_onlykey");
    vi.stubEnv("PHRONY_TENANT_ID", tenant);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(resolveCliAuth({ cwd: process.cwd() })).rejects.toThrow(/PHRONY_ACCESS_TOKEN|phrony login/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
