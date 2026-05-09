/**
 * Keep aligned with `@phrony/srv-contracts` `manifest-inputs.ts` (Phrony monorepo).
 * Manifest `{{inputs.key}}` placeholders — string leaves only.
 */

const PLACEHOLDER_INNER = /^inputs\.[a-zA-Z0-9_]+$/;
const PLACEHOLDER_GLOBAL = /\{\{\s*inputs\.([a-zA-Z0-9_]+)\s*\}\}/g;

function walkStrings(value: unknown, visit: (s: string) => void): void {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const x of value) {
      walkStrings(x, visit);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      walkStrings(v, visit);
    }
  }
}

export function collectManifestInputPlaceholderKeys(value: unknown): Set<string> {
  const keys = new Set<string>();
  walkStrings(value, (s) => {
    const re = new RegExp(PLACEHOLDER_GLOBAL.source, "g");
    let m: RegExpExecArray | null;
    for (;;) {
      m = re.exec(s);
      if (m == null) {
        break;
      }
      keys.add(m[1]!);
    }
  });
  return keys;
}

export function collectMalformedManifestPlaceholders(value: unknown): string[] {
  const samples: string[] = [];
  walkStrings(value, (s) => {
    if (!s.includes("{{")) {
      return;
    }
    let pos = 0;
    while (pos < s.length) {
      const start = s.indexOf("{{", pos);
      if (start < 0) {
        break;
      }
      const end = s.indexOf("}}", start + 2);
      if (end < 0) {
        samples.push(s.length > 120 ? `${s.slice(0, 120)}…` : s);
        return;
      }
      const inner = s.slice(start + 2, end).trim();
      if (!PLACEHOLDER_INNER.test(inner)) {
        samples.push(s.length > 120 ? `${s.slice(0, 120)}…` : s);
        return;
      }
      pos = end + 2;
    }
  });
  return samples;
}

export function deepSubstituteManifestInputs(
  value: unknown,
  inputs: Readonly<Record<string, string>>,
  depth = 0,
): unknown {
  if (depth > 64) {
    throw new Error("manifest input substitution depth exceeded");
  }
  if (typeof value === "string") {
    return value.replace(PLACEHOLDER_GLOBAL, (_, key: string) => {
      if (!(key in inputs)) {
        throw new Error(`unresolved manifest input placeholder: inputs.${key}`);
      }
      return inputs[key] ?? "";
    });
  }
  if (Array.isArray(value)) {
    return value.map((x) => deepSubstituteManifestInputs(x, inputs, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = deepSubstituteManifestInputs(v, inputs, depth + 1);
    }
    return out;
  }
  return value;
}

export function listUnresolvedInputPlaceholderKeys(
  value: unknown,
  inputs: Readonly<Record<string, string>>,
): string[] {
  const needed = collectManifestInputPlaceholderKeys(value);
  return [...needed].filter((k) => {
    const v = inputs[k];
    return v === undefined || v === null || String(v).length === 0;
  });
}

export function extractDeclaredInputKeysFromRawDoc(doc: unknown): Set<string> {
  const out = new Set<string>();
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return out;
  }
  const inp = (doc as Record<string, unknown>).inputs;
  if (!Array.isArray(inp)) {
    return out;
  }
  for (const row of inp) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const k = (row as Record<string, unknown>).key;
      if (typeof k === "string" && k.length > 0) {
        out.add(k);
      }
    }
  }
  return out;
}

export function yamlTextLikelyHasInputPlaceholders(yamlText: string): boolean {
  return /\{\{\s*inputs\./.test(yamlText);
}
