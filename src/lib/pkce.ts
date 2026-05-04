import { createHash, randomBytes } from "node:crypto";

/** Public OAuth client id registered with the Phrony gateway. */
export const PHRONY_CLI_OAUTH_CLIENT_ID = "phrony-cli";

/** RFC 7636: 43–128 characters, unreserved [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~" */
export function randomPkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function pkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

export function randomOAuthState(): string {
  return randomBytes(24).toString("base64url");
}
