import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { pkceChallengeS256, randomPkceVerifier } from "../src/lib/pkce.js";

describe("PKCE helpers", () => {
  it("produces verifier within RFC 7636 length bounds", () => {
    const v = randomPkceVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it("S256 challenge matches SHA256 base64url", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expected = createHash("sha256").update(verifier, "utf8").digest("base64url");
    expect(pkceChallengeS256(verifier)).toBe(expected);
  });
});
