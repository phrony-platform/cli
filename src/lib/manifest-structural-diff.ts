import type { ManifestChangeAction, ManifestChangeResource } from "../schema/manifest-apply-result.schemas.js";
import type { PhronyManifestV1 } from "../schema/manifest-document.schemas.js";
import {
  canonicalAgentVersionRecord,
  canonicalLlmProviderRecord,
} from "./manifest-diff-normalize.js";
import type { ManifestPlanRowDto, ManifestPlanTableDto } from "./manifest-plan-dto.js";

function serviceKey(s: { manifestKey?: string; name: string }): string {
  return s.manifestKey ?? `name:${s.name}`;
}

function versionKey(v: { agentManifestKey: string; versionLabel: string }): string {
  return `${v.agentManifestKey}@${v.versionLabel}`;
}

function triggerKey(t: { agentManifestKey: string; manifestKey?: string; name: string }): string {
  return `${t.agentManifestKey}@${t.manifestKey ?? t.name}`;
}

function shallowDiffLines(
  label: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  max = 12,
): string[] {
  const a = before ?? {};
  const b = after ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of [...keys].sort()) {
    if (out.length >= max) {
      out.push(`… (${label}: truncated)`);
      break;
    }
    const av = a[k];
    const bv = b[k];
    if (!(k in b)) {
      out.push(`- ${label}.${k} ${JSON.stringify(av)}`);
    } else if (!(k in a)) {
      out.push(`+ ${label}.${k} ${JSON.stringify(bv)}`);
    } else if (JSON.stringify(av) !== JSON.stringify(bv)) {
      out.push(`~ ${label}.${k} ${JSON.stringify(av)} → ${JSON.stringify(bv)}`);
    }
  }
  return out;
}

function mapBy<T>(items: T[] | undefined, keyFn: (x: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of items ?? []) {
    const k = keyFn(x);
    if (m.has(k)) {
      throw new Error(`duplicate key in manifest list for structural diff: ${k}`);
    }
    m.set(k, x);
  }
  return m;
}

/**
 * Structural diff between two merged manifest trees (for `phrony diff`), reusing the plan row shape.
 */
export function diffManifestTrees(local: PhronyManifestV1, remote: PhronyManifestV1): ManifestPlanTableDto {
  const changes: ManifestPlanRowDto[] = [];

  const msgLocalOnly = "present only in local manifest (not in remote export)";
  const msgRemoteOnly = "present only in remote export (not in local manifest)";

  const push = (
    action: ManifestChangeAction,
    resource: ManifestChangeResource,
    key: string,
    message?: string,
    details?: string[],
  ) => {
    changes.push({ action, resource, key, message, details });
  };

  const llmL = mapBy(local.llmProviders, (x) => x.name);
  const llmR = mapBy(remote.llmProviders, (x) => x.name);
  for (const k of new Set([...llmL.keys(), ...llmR.keys()])) {
    const l = llmL.get(k);
    const r = llmR.get(k);
    if (l && !r) {
      push("CREATE", "llm_provider_ref", k, msgLocalOnly);
    } else if (!l && r) {
      push("DELETE", "llm_provider_ref", k, msgRemoteOnly);
    } else if (l && r) {
      const a = canonicalLlmProviderRecord(l);
      const b = canonicalLlmProviderRecord(r);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        push("UPDATE", "llm_provider_ref", k, undefined, shallowDiffLines("llmProvider", a, b));
      }
    }
  }

  const svcL = mapBy(local.services, serviceKey);
  const svcR = mapBy(remote.services, serviceKey);
  for (const k of new Set([...svcL.keys(), ...svcR.keys()])) {
    const l = svcL.get(k);
    const r = svcR.get(k);
    if (l && !r) {
      push("CREATE", "service", k, msgLocalOnly);
    } else if (!l && r) {
      push("DELETE", "service", k, msgRemoteOnly);
    } else if (l && r && JSON.stringify(l) !== JSON.stringify(r)) {
      push("UPDATE", "service", k, undefined, shallowDiffLines("service", l as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>));
    }
  }

  const agL = mapBy(local.agents, (a) => a.manifestKey);
  const agR = mapBy(remote.agents, (a) => a.manifestKey);
  for (const k of new Set([...agL.keys(), ...agR.keys()])) {
    const l = agL.get(k);
    const r = agR.get(k);
    if (l && !r) {
      push("CREATE", "agent", k, msgLocalOnly);
    } else if (!l && r) {
      push("DELETE", "agent", k, msgRemoteOnly);
    } else if (l && r && JSON.stringify(l) !== JSON.stringify(r)) {
      push("UPDATE", "agent", k, undefined, shallowDiffLines("agent", l as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>));
    }
  }

  const verL = mapBy(local.versions, versionKey);
  const verR = mapBy(remote.versions, versionKey);
  for (const k of new Set([...verL.keys(), ...verR.keys()])) {
    const l = verL.get(k);
    const r = verR.get(k);
    if (l && !r) {
      push("CREATE", "agent_version", k, msgLocalOnly);
    } else if (!l && r) {
      push("DELETE", "agent_version", k, msgRemoteOnly);
    } else if (l && r) {
      const a = canonicalAgentVersionRecord(l);
      const b = canonicalAgentVersionRecord(r);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        push("UPDATE", "agent_version", k, undefined, shallowDiffLines("version", a, b));
      }
    }
  }

  const trL = mapBy(local.triggers, triggerKey);
  const trR = mapBy(remote.triggers, triggerKey);
  for (const k of new Set([...trL.keys(), ...trR.keys()])) {
    const l = trL.get(k);
    const r = trR.get(k);
    if (l && !r) {
      push("CREATE", "trigger", k, msgLocalOnly);
    } else if (!l && r) {
      push("DELETE", "trigger", k, msgRemoteOnly);
    } else if (l && r && JSON.stringify(l) !== JSON.stringify(r)) {
      push("UPDATE", "trigger", k, undefined, shallowDiffLines("trigger", l as unknown as Record<string, unknown>, r as unknown as Record<string, unknown>));
    }
  }

  const flatOps = (m: PhronyManifestV1) => {
    const map = new Map<string, { svc: string; op: string; body: unknown }>();
    for (const s of m.services ?? []) {
      const sk = serviceKey(s);
      for (const o of s.operations ?? []) {
        const ok = `${sk}>${o.manifestKey ?? o.name}`;
        if (map.has(ok)) {
          throw new Error(`duplicate operation key in manifest for structural diff: ${ok}`);
        }
        map.set(ok, { svc: sk, op: o.manifestKey ?? o.name, body: o });
      }
    }
    return map;
  };
  const oL = flatOps(local);
  const oR = flatOps(remote);
  for (const k of new Set([...oL.keys(), ...oR.keys()])) {
    const l = oL.get(k);
    const r = oR.get(k);
    if (l && !r) {
      push("CREATE", "operation", k, msgLocalOnly);
    } else if (!l && r) {
      push("DELETE", "operation", k, msgRemoteOnly);
    } else if (l && r && JSON.stringify(l.body) !== JSON.stringify(r.body)) {
      push(
        "UPDATE",
        "operation",
        k,
        undefined,
        shallowDiffLines(
          "operation",
          l.body as Record<string, unknown>,
          r.body as Record<string, unknown>,
        ),
      );
    }
  }

  return { changes, presentation: "structural_diff" };
}
