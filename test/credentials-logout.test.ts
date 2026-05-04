import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  listCredentialsProfiles,
  parseCredentialsToml,
  removeProfileOAuthCredentials,
} from "../src/lib/credentials.js";

describe("removeProfileOAuthCredentials", () => {
  it("reports missing file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "nope");
    expect(removeProfileOAuthCredentials(p, "default")).toEqual({
      missingFile: true,
      noProfileTable: false,
      hadOAuthSession: false,
      updated: false,
      removedProfile: false,
    });
  });

  it("reports no profile table", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "credentials");
    writeFileSync(p, 'other = "x"\n', "utf8");
    expect(removeProfileOAuthCredentials(p, "dev")).toMatchObject({
      missingFile: false,
      noProfileTable: true,
      updated: false,
    });
  });

  it("reports no oauth session when profile has no oauth keys", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "credentials");
    writeFileSync(p, '[dev]\napi_key = "k"\n', "utf8");
    expect(removeProfileOAuthCredentials(p, "dev")).toEqual({
      missingFile: false,
      noProfileTable: false,
      hadOAuthSession: false,
      updated: false,
      removedProfile: false,
    });
  });

  it("strips oauth and removes empty profile; clears default pointer", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "credentials");
    writeFileSync(
      p,
      `default = "mine"\n\n[mine]\naccess_token = "at"\nrefresh_token = "rt"\naccess_expires_at_ms = 9\ntenant_id = "00000000-0000-4000-8000-000000000001"\n`,
      "utf8",
    );

    const r = removeProfileOAuthCredentials(p, "mine");
    expect(r).toMatchObject({
      hadOAuthSession: true,
      updated: true,
      removedProfile: true,
    });

    const doc = parseCredentialsToml(readFileSync(p, "utf8"));
    expect(doc.default).toBeUndefined();
    expect(doc.mine).toBeUndefined();
  });

  it("strips oauth but keeps profile when api_key remains", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "credentials");
    writeFileSync(
      p,
      `[both]
access_token = "at"
refresh_token = "rt"
access_expires_at_ms = 9
tenant_id = "00000000-0000-4000-8000-000000000002"
api_base = "https://api.example.com"
user_email = "a@b.c"
api_key = "secret"
`,
      "utf8",
    );

    const r = removeProfileOAuthCredentials(p, "both");
    expect(r).toMatchObject({
      hadOAuthSession: true,
      updated: true,
      removedProfile: false,
    });

    const doc = parseCredentialsToml(readFileSync(p, "utf8"));
    const t = doc.both as Record<string, unknown>;
    expect(t.api_key).toBe("secret");
    expect(t.access_token).toBeUndefined();
    expect(t.refresh_token).toBeUndefined();
  });
});

describe("listCredentialsProfiles", () => {
  it("returns missingFile when path does not exist", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "missing");
    expect(listCredentialsProfiles(p)).toEqual({ missingFile: true, profiles: [] });
  });

  it("lists profile tables with flags and file default", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "credentials");
    writeFileSync(
      p,
      `default = "alpha"

[alpha]
access_token = "a"
refresh_token = "r"
access_expires_at_ms = 1
tenant_id = "00000000-0000-4000-8000-000000000099"

[zeta]
api_key = "k"
`,
      "utf8",
    );
    const r = listCredentialsProfiles(p);
    expect(r.missingFile).toBe(false);
    expect(r.fileDefaultProfile).toBe("alpha");
    expect(r.profiles).toEqual([
      { name: "alpha", hasOAuthSession: true, hasAccessToken: true },
      { name: "zeta", hasOAuthSession: false, hasAccessToken: false },
    ]);
  });

  it("lists the [default] profile table (not only default = \"…\" pointer)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "credentials");
    writeFileSync(
      p,
      `[default]
access_token = "a"
refresh_token = "r"
access_expires_at_ms = 1
tenant_id = "00000000-0000-4000-8000-000000000001"
`,
      "utf8",
    );
    const r = listCredentialsProfiles(p);
    expect(r.missingFile).toBe(false);
    expect(r.fileDefaultProfile).toBeUndefined();
    expect(r.profiles).toEqual([
      { name: "default", hasOAuthSession: true, hasAccessToken: true },
    ]);
  });

  it("marks access token when only access_token is present (incomplete OAuth)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "phrony-cli-cred-"));
    const p = path.join(dir, "credentials");
    writeFileSync(p, "[partial]\naccess_token = \"only\"\n", "utf8");
    const r = listCredentialsProfiles(p);
    expect(r.profiles).toEqual([
      { name: "partial", hasOAuthSession: false, hasAccessToken: true },
    ]);
  });
});
