import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

/** Owner read/write only (credential store). */
const CREDENTIALS_FILE_MODE = 0o600;

/** Drop stale locks after this age so a crashed CLI cannot block writes forever. */
const CREDENTIALS_LOCK_STALE_MS = 45_000;

/** Max time to wait for another process to release `credentials.lock`. */
const CREDENTIALS_LOCK_WAIT_MS = 15_000;

function credentialsLockPath(filePath: string): string {
  return `${filePath}.lock`;
}

function sleepMs(ms: number): void {
  try {
    const sab = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(sab), 0, 0, ms);
  } catch {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      /* spin */
    }
  }
}

function tryRemoveStaleCredentialsLock(lockPath: string): void {
  try {
    const st = statSync(lockPath);
    if (Date.now() - st.mtimeMs > CREDENTIALS_LOCK_STALE_MS) {
      unlinkSync(lockPath);
    }
  } catch {
    /* missing or race */
  }
}

function acquireCredentialsFileLock(filePath: string): void {
  const lockPath = credentialsLockPath(filePath);
  const deadline = Date.now() + CREDENTIALS_LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const fd = openSync(lockPath, "wx");
      try {
        writeFileSync(fd, `${process.pid}\n`);
      } finally {
        closeSync(fd);
      }
      return;
    } catch {
      tryRemoveStaleCredentialsLock(lockPath);
      sleepMs(30 + Math.floor(Math.random() * 40));
    }
  }
  throw new Error(
    `Timed out waiting for credentials lock (${lockPath}). Another Phrony CLI process may be refreshing tokens; retry shortly.`,
  );
}

function releaseCredentialsFileLock(filePath: string): void {
  try {
    unlinkSync(credentialsLockPath(filePath));
  } catch {
    /* ignore */
  }
}

function writeCredentialsFileAtomic(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.credentials.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, content, { encoding: "utf8", mode: CREDENTIALS_FILE_MODE });
    try {
      chmodSync(tmp, CREDENTIALS_FILE_MODE);
    } catch {
      /* Windows may ignore chmod */
    }
    renameSync(tmp, filePath);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  }
  try {
    chmodSync(filePath, CREDENTIALS_FILE_MODE);
  } catch {
    /* Windows may ignore chmod */
  }
}

export const DEFAULT_CREDENTIALS_REL = path.join(".phrony", "credentials");

export type ProfileCredentials = {
  apiKey: string;
};

/** OAuth tokens from `phrony login` (PKCE); stored under a named profile table. */
export type ProfileOAuthCredentials = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when access token should be treated as expired */
  accessExpiresAtMs: number;
  tenantId: string;
  /** Gateway origin used for this login (optional fallback for resolution). */
  apiBase?: string;
  userEmail?: string;
};

export type CredentialsFile = {
  /** Optional preferred profile when `--profile` is omitted. */
  default?: string;
  /** Named profiles: each may define `api_key`. */
  [profileName: string]: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function readApiKeyFromTable(table: unknown): string | undefined {
  if (!isRecord(table)) {
    return undefined;
  }
  const raw = table.api_key ?? table.apiKey;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function readStringField(table: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = table[k];
    if (typeof v === "string" && v.length > 0) {
      return v;
    }
  }
  return undefined;
}

function readNumberField(table: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = table[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  }
  return undefined;
}

function profileOAuthFromTable(table: Record<string, unknown>): ProfileOAuthCredentials | undefined {
  const accessToken = readStringField(table, "access_token", "accessToken");
  const refreshToken = readStringField(table, "refresh_token", "refreshToken");
  const tenantId = readStringField(table, "tenant_id", "tenantId");
  const accessExpiresAtMs = readNumberField(table, "access_expires_at_ms", "accessExpiresAtMs");
  if (!accessToken || !refreshToken || !tenantId || accessExpiresAtMs === undefined) {
    return undefined;
  }
  const apiBase = readStringField(table, "api_base", "apiBase");
  const userEmail = readStringField(table, "user_email", "userEmail");
  return {
    accessToken,
    refreshToken,
    accessExpiresAtMs,
    tenantId,
    ...(apiBase !== undefined ? { apiBase } : {}),
    ...(userEmail !== undefined ? { userEmail } : {}),
  };
}

export function loadProfileOAuthFromCredentialsFile(
  filePath: string,
  profileName: string,
): ProfileOAuthCredentials | undefined {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  const doc = parseCredentialsToml(text);
  const table = doc[profileName];
  if (!isRecord(table)) {
    return undefined;
  }
  return profileOAuthFromTable(table);
}

/** `api_base` / `apiBase` on a profile table (for example after a prior login), without requiring a full OAuth row. */
export function readProfileApiBaseFromCredentialsFile(
  filePath: string,
  profileName: string,
): string | undefined {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  const doc = parseCredentialsToml(text);
  const table = doc[profileName];
  if (!isRecord(table)) {
    return undefined;
  }
  const raw = readStringField(table, "api_base", "apiBase");
  return raw !== undefined && raw.trim() !== "" ? raw.trim() : undefined;
}

export type ListedCredentialProfile = {
  name: string;
  hasOAuthSession: boolean;
  /** Non-empty `access_token` / `accessToken` in the profile table (may be expired). */
  hasAccessToken: boolean;
};

export type ListCredentialsProfilesResult = {
  missingFile: boolean;
  /** `default = "…"` in the credentials TOML when set. */
  fileDefaultProfile?: string;
  profiles: ListedCredentialProfile[];
};

/**
 * Read the credentials file once and return profile tables with capability flags (no secrets).
 */
export function listCredentialsProfiles(filePath: string): ListCredentialsProfilesResult {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return { missingFile: true, profiles: [] };
  }
  const doc = parseCredentialsToml(text) as CredentialsFile;
  const fd =
    typeof doc.default === "string" && doc.default.trim() !== "" ? doc.default.trim() : undefined;
  const profiles: ListedCredentialProfile[] = [];
  for (const [name, v] of Object.entries(doc)) {
    /* `default = "profileName"` is metadata; `[default]` is a real profile table. */
    if (name === "default" && typeof v === "string") {
      continue;
    }
    if (!isRecord(v)) {
      continue;
    }
    profiles.push({
      name,
      hasOAuthSession: profileOAuthFromTable(v) !== undefined,
      hasAccessToken:
        (readStringField(v, "access_token", "accessToken")?.length ?? 0) > 0,
    });
  }
  profiles.sort((a, b) => a.name.localeCompare(b.name));
  return { missingFile: false, ...(fd !== undefined ? { fileDefaultProfile: fd } : {}), profiles };
}

/**
 * `~/.phrony/credentials` (override with `PHRONY_CREDENTIALS_FILE`).
 */
export function defaultCredentialsPath(): string {
  const override = process.env.PHRONY_CREDENTIALS_FILE;
  if (override && override.trim() !== "") {
    return path.resolve(override);
  }
  return path.join(homedir(), ".phrony", "credentials");
}

export function parseCredentialsToml(text: string): CredentialsFile {
  return parseToml(text) as CredentialsFile;
}

export function loadProfileFromCredentialsFile(
  filePath: string,
  profileName: string,
): ProfileCredentials | undefined {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  const doc = parseCredentialsToml(text);
  const table = doc[profileName];
  const apiKey = readApiKeyFromTable(table);
  if (!apiKey) {
    return undefined;
  }
  return { apiKey };
}

export function resolveDefaultProfileName(filePath: string): string | undefined {
  try {
    const text = readFileSync(filePath, "utf8");
    const doc = parseCredentialsToml(text);
    const d = doc.default;
    return typeof d === "string" && d.length > 0 ? d : undefined;
  } catch {
    return undefined;
  }
}

export type PersistProfileOAuthInput = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAtMs: number;
  tenantId: string;
  apiBase?: string;
  userEmail?: string;
};

/** Keys written or accepted for OAuth sessions in a profile table (both spellings). */
const OAUTH_PROFILE_FIELD_KEYS = [
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "access_expires_at_ms",
  "accessExpiresAtMs",
  "tenant_id",
  "tenantId",
  "api_base",
  "apiBase",
  "user_email",
  "userEmail",
] as const;

function profileRecordHasOAuthKeys(table: Record<string, unknown>): boolean {
  for (const k of OAUTH_PROFILE_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(table, k)) {
      return true;
    }
  }
  return false;
}

export type RemoveProfileOAuthResult = {
  /** Credentials file did not exist. */
  missingFile: boolean;
  /** No `[profile]` table (or not an object). */
  noProfileTable: boolean;
  /** OAuth-related keys were present before removal. */
  hadOAuthSession: boolean;
  /** Credentials file was rewritten. */
  updated: boolean;
  /** Profile table was dropped because nothing remained after stripping OAuth fields. */
  removedProfile: boolean;
};

/**
 * Remove OAuth fields for a profile from the credentials TOML (advisory lock + atomic write).
 * Preserves unrelated keys (for example `api_key`). Clears top-level `default` if it pointed at a removed profile.
 */
export function removeProfileOAuthCredentials(
  filePath: string,
  profileName: string,
): RemoveProfileOAuthResult {
  const empty: RemoveProfileOAuthResult = {
    missingFile: false,
    noProfileTable: false,
    hadOAuthSession: false,
    updated: false,
    removedProfile: false,
  };

  acquireCredentialsFileLock(filePath);
  try {
    let text: string;
    try {
      text = readFileSync(filePath, "utf8");
    } catch {
      return { ...empty, missingFile: true };
    }

    const doc = parseCredentialsToml(text) as CredentialsFile;
    const prev = doc[profileName];
    if (!isRecord(prev)) {
      return { ...empty, noProfileTable: true };
    }

    if (!profileRecordHasOAuthKeys(prev)) {
      return { ...empty, noProfileTable: false, hadOAuthSession: false };
    }

    const nextTable: Record<string, unknown> = { ...prev };
    for (const k of OAUTH_PROFILE_FIELD_KEYS) {
      delete nextTable[k];
    }

    const out: Record<string, unknown> = { ...doc };
    const keyCount = Object.keys(nextTable).length;
    if (keyCount === 0) {
      delete out[profileName];
      const d = out.default;
      if (typeof d === "string" && d === profileName) {
        delete out.default;
      }
    } else {
      out[profileName] = nextTable;
    }

    const body = `${stringifyToml(out as Record<string, unknown>)}\n`;
    writeCredentialsFileAtomic(filePath, body);
    return {
      missingFile: false,
      noProfileTable: false,
      hadOAuthSession: true,
      updated: true,
      removedProfile: keyCount === 0,
    };
  } finally {
    releaseCredentialsFileLock(filePath);
  }
}

/**
 * Merge OAuth fields into a profile table in `~/.phrony/credentials`, preserving other profiles.
 * Uses an advisory lock + atomic replace so concurrent refreshes do not corrupt the file; sets mode 0o600.
 */
export function persistProfileOAuthCredentials(
  filePath: string,
  profileName: string,
  data: PersistProfileOAuthInput,
): void {
  acquireCredentialsFileLock(filePath);
  try {
    let doc: CredentialsFile = {};
    try {
      const text = readFileSync(filePath, "utf8");
      doc = parseCredentialsToml(text) as CredentialsFile;
    } catch {
      doc = {};
    }

    const prev = doc[profileName];
    const base = isRecord(prev) ? { ...prev } : {};
    const nextTable: Record<string, unknown> = {
      ...base,
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      access_expires_at_ms: data.accessExpiresAtMs,
      tenant_id: data.tenantId,
    };
    if (data.apiBase !== undefined && data.apiBase !== "") {
      nextTable.api_base = data.apiBase;
    }
    if (data.userEmail !== undefined && data.userEmail !== "") {
      nextTable.user_email = data.userEmail;
    }

    const out: Record<string, unknown> = { ...doc, [profileName]: nextTable };
    const body = `${stringifyToml(out as Record<string, unknown>)}\n`;
    writeCredentialsFileAtomic(filePath, body);
  } finally {
    releaseCredentialsFileLock(filePath);
  }
}
