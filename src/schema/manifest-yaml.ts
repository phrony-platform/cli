import { parseAllDocuments, stringify } from "yaml";
import {
  collectMalformedManifestPlaceholders,
  collectManifestInputPlaceholderKeys,
  deepSubstituteManifestInputs,
  extractDeclaredInputKeysFromRawDoc,
} from "../lib/manifest-inputs.js";
import {
  PhronyManifestDocumentV1Schema,
  PhronyManifestIndexV1Schema,
} from "./manifest-document.schemas.js";
import type {
  PhronyManifestDocumentV1,
  PhronyManifestIndexV1,
  PhronyManifestV1,
} from "./manifest-document.schemas.js";

const YAML_PARSE_OPTIONS = { merge: false, uniqueKeys: true } as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isIndexDoc(v: unknown): v is PhronyManifestIndexV1 {
  return (
    isPlainObject(v) &&
    v.kind === "phrony.manifest.index" &&
    v.version === 1 &&
    Array.isArray(v.includes)
  );
}

function mergeByKey<T>(existing: T[], incoming: T[], keyFn: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const x of existing) {
    map.set(keyFn(x), x);
  }
  for (const x of incoming) {
    map.set(keyFn(x), x);
  }
  return [...map.values()];
}

function mergeManifestDocuments(base: PhronyManifestV1, next: PhronyManifestV1): PhronyManifestV1 {
  const meta = { ...base.metadata, ...next.metadata };
  return {
    kind: "phrony.manifest",
    version: 1,
    metadata: Object.keys(meta).length ? meta : undefined,
    inputs: mergeByKey(base.inputs ?? [], next.inputs ?? [], (x) => x.key),
    llmProviders: mergeByKey(base.llmProviders ?? [], next.llmProviders ?? [], (x) => x.name),
    services: mergeByKey(
      base.services ?? [],
      next.services ?? [],
      (x) => x.manifestKey ?? `name:${x.name}`,
    ),
    agents: mergeByKey(base.agents ?? [], next.agents ?? [], (x) => x.manifestKey),
    versions: mergeByKey(
      base.versions ?? [],
      next.versions ?? [],
      (x) => `${x.agentManifestKey}\0${x.versionLabel}`,
    ),
    triggers: mergeByKey(
      base.triggers ?? [],
      next.triggers ?? [],
      (t) => `${t.agentManifestKey}\0${t.manifestKey ?? t.name}`,
    ),
  };
}

export function normalizeManifestKind(doc: PhronyManifestDocumentV1): PhronyManifestV1 {
  if (doc.kind !== "phrony.manifest" && doc.kind !== "phrony.workspace.manifest") {
    throw new Error("unexpected manifest kind");
  }
  return { ...doc, kind: "phrony.manifest" };
}

export function collectRawManifestDocumentsFromYaml(yamlText: string): unknown[] {
  const collected: unknown[] = [];

  const visitText = (text: string, depth: number) => {
    if (depth > 32) {
      throw new Error("manifest include depth exceeded");
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const streamDocs = parseAllDocuments(trimmed, YAML_PARSE_OPTIONS);
    for (const d of streamDocs) {
      const js = d.toJS(YAML_PARSE_OPTIONS);
      if (
        js == null ||
        (typeof js === "object" && !Array.isArray(js) && Object.keys(js).length === 0)
      ) {
        continue;
      }
      if (isIndexDoc(js)) {
        const parsedIndex = PhronyManifestIndexV1Schema.parse(js);
        for (const inc of parsedIndex.includes) {
          visitText(inc, depth + 1);
        }
        continue;
      }
      collected.push(js);
    }
  };

  visitText(yamlText, 0);
  return collected;
}

export type ParsePhronyManifestYamlOptions = {
  inputs?: Record<string, string>;
};

export function parsePhronyManifestYaml(
  yamlText: string,
  opts?: ParsePhronyManifestYamlOptions,
): PhronyManifestV1 {
  const collected: PhronyManifestDocumentV1[] = [];

  const visitText = (text: string, depth: number) => {
    if (depth > 32) {
      throw new Error("manifest include depth exceeded");
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const streamDocs = parseAllDocuments(trimmed, YAML_PARSE_OPTIONS);
    for (const d of streamDocs) {
      const js = d.toJS(YAML_PARSE_OPTIONS);
      if (
        js == null ||
        (typeof js === "object" && !Array.isArray(js) && Object.keys(js).length === 0)
      ) {
        continue;
      }
      if (isIndexDoc(js)) {
        const parsedIndex = PhronyManifestIndexV1Schema.parse(js);
        for (const inc of parsedIndex.includes) {
          visitText(inc, depth + 1);
        }
        continue;
      }
      const malformed = collectMalformedManifestPlaceholders(js);
      if (malformed.length > 0) {
        throw new Error(
          `manifest contains invalid {{…}} placeholders (only {{inputs.KEY}} is allowed). Example: ${malformed[0]}`,
        );
      }
      const declared = extractDeclaredInputKeysFromRawDoc(js);
      const phKeys = collectManifestInputPlaceholderKeys(js);
      if (declared.size > 0) {
        const undeclared = [...phKeys].filter((k) => !declared.has(k));
        if (undeclared.length > 0) {
          throw new Error(
            `manifest inputs: placeholders ${undeclared.map((k) => `{{inputs.${k}}}`).join(", ")} must each be declared in this document's inputs[]`,
          );
        }
      }
      let prepared: unknown = js;
      if (opts?.inputs && Object.keys(opts.inputs).length > 0) {
        prepared = deepSubstituteManifestInputs(js, opts.inputs);
      }
      collected.push(PhronyManifestDocumentV1Schema.parse(prepared));
    }
  };

  visitText(yamlText, 0);

  return mergePhronyManifestDocuments(collected);
}

/** Merge one or more validated manifest documents (multi-doc / includes) into a single tree. */
export function mergePhronyManifestDocuments(
  collected: PhronyManifestDocumentV1[],
): PhronyManifestV1 {
  if (collected.length === 0) {
    throw new Error("no phrony.manifest documents found in YAML");
  }
  let merged = normalizeManifestKind(collected[0]);
  for (let i = 1; i < collected.length; i++) {
    merged = mergeManifestDocuments(merged, normalizeManifestKind(collected[i]));
  }
  return merged;
}

export function stringifyPhronyManifest(doc: PhronyManifestV1): string {
  return stringify(
    { ...doc, kind: "phrony.manifest" },
    { lineWidth: 120, indent: 2, sortMapEntries: false },
  );
}

export function sanitizeServiceConfigForManifest(config: unknown): {
  sanitized: unknown;
  secretsRedacted: boolean;
} {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    return { sanitized: config, secretsRedacted: false };
  }
  const c = { ...(config as Record<string, unknown>) };
  let redacted = false;
  const auth = c.auth;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    const a = { ...(auth as Record<string, unknown>) };
    if ("secretId" in a && a.secretId != null) {
      delete a.secretId;
      redacted = true;
    }
    c.auth = a;
  }
  if ("connectedAccountId" in c && c.connectedAccountId != null) {
    delete c.connectedAccountId;
    redacted = true;
  }
  return { sanitized: c, secretsRedacted: redacted };
}
