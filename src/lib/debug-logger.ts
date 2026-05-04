const PHK = /\bphk_[a-zA-Z0-9_]+\b/g;
const BEARER = /\bBearer\s+\S+/gi;
const X_API_KEY = /\bX-API-Key:\s*\S+/gi;
const AUTH_HEADER = /\bAuthorization:\s*\S+/gi;

/**
 * Redact secrets for `--debug` stderr logging.
 */
export function redactSecrets(message: string): string {
  return message
    .replace(PHK, "phk_[REDACTED]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(X_API_KEY, "X-API-Key: [REDACTED]")
    .replace(AUTH_HEADER, "Authorization: [REDACTED]");
}

export type DebugLogger = (message: string, extra?: unknown) => void;

export function createDebugLogger(enabled: boolean): DebugLogger {
  if (!enabled) {
    return () => {};
  }
  return (message, extra) => {
    const base = redactSecrets(message);
    if (extra !== undefined) {
      try {
        const serialized =
          typeof extra === "string" ? redactSecrets(extra) : redactSecrets(JSON.stringify(extra));
        console.error(`[phrony:debug] ${base} ${serialized}`);
      } catch {
        console.error(`[phrony:debug] ${base}`);
      }
    } else {
      console.error(`[phrony:debug] ${base}`);
    }
  };
}
