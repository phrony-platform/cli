/** Max length for non-JSON error snippets shown in the terminal */
const PLAIN_TEXT_CAP = 500;

/**
 * Turns a gateway HTTP response body (often JSON from Nest or similar) into a single-line
 * message suitable for stderr / CLI `--json` error payloads.
 */
export function formatGatewayErrorBody(bodyText: string): string {
  const raw = bodyText.trim();
  if (!raw) {
    return "No error details were returned.";
  }

  const looksJsonObject = raw.startsWith("{") && raw.endsWith("}");
  const looksJsonArray = raw.startsWith("[") && raw.endsWith("]");
  if (looksJsonObject || looksJsonArray) {
    try {
      return messageFromParsedGatewayJson(JSON.parse(raw) as unknown);
    } catch {
      // Invalid JSON despite braces — fall through to plain text
    }
  }

  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length > PLAIN_TEXT_CAP) {
    return `${oneLine.slice(0, PLAIN_TEXT_CAP - 3)}...`;
  }
  return oneLine;
}

function messageFromParsedGatewayJson(data: unknown): string {
  if (data == null) {
    return "Request failed";
  }
  if (Array.isArray(data)) {
    const parts = data.map((x) => coerceFragment(x)).filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : "Request failed";
  }
  if (typeof data !== "object") {
    return "Request failed";
  }
  const o = data as Record<string, unknown>;
  const fromMsg = extractMessageField(o.message);
  if (fromMsg) {
    return fromMsg;
  }
  const fromErr = extractMessageField(o.error);
  if (fromErr) {
    return fromErr;
  }
  if (typeof o.detail === "string" && o.detail.trim()) {
    return o.detail.trim();
  }
  return "Request failed";
}

function extractMessageField(m: unknown): string | null {
  if (typeof m === "string" && m.trim()) {
    return m.trim();
  }
  if (Array.isArray(m)) {
    const parts = m.map((x) => coerceFragment(x)).filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : null;
  }
  if (m && typeof m === "object") {
    const inner = (m as Record<string, unknown>).message;
    if (typeof inner === "string" && inner.trim()) {
      return inner.trim();
    }
    if (Array.isArray(inner)) {
      const parts = inner.map((x) => coerceFragment(x)).filter(Boolean);
      return parts.length > 0 ? parts.join("; ") : null;
    }
  }
  return null;
}

function coerceFragment(x: unknown): string {
  if (typeof x === "string") {
    return x.trim();
  }
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const rec = x as Record<string, unknown>;
    if (typeof rec.property === "string" && rec.constraints && typeof rec.constraints === "object") {
      const c = rec.constraints as Record<string, string>;
      const first = Object.values(c).find((v) => typeof v === "string");
      if (typeof first === "string") {
        return `${rec.property}: ${first}`;
      }
    }
    const nested = extractMessageField(rec.message ?? rec.error);
    if (nested) {
      return nested;
    }
  }
  return "";
}
