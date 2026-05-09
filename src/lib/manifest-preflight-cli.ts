import type { ManifestPreflightResult } from "../schema/manifest-apply-result.schemas.js";

export function describeManifestPreflightFailure(preflight: ManifestPreflightResult): string {
  const lines: string[] = [];
  if (preflight.parseError) {
    lines.push(`Parse error: ${preflight.parseError}`);
  }
  for (const b of preflight.blockers) {
    if (b.kind === "missing_llm_provider") {
      lines.push(
        `Missing LLM providers (create them in the Phrony dashboard first): ${b.names.join(", ")}`,
      );
    } else if (b.kind === "malformed_placeholder") {
      lines.push(`Invalid placeholders: ${b.samples.join(" | ")}`);
    } else if (b.kind === "undeclared_input_placeholder") {
      lines.push(`Undeclared input placeholders: ${b.keys.join(", ")}`);
    }
  }
  if (preflight.missingInputs?.length) {
    lines.push(
      `Missing values for inputs: ${preflight.missingInputs.join(", ")} — add phrony.values.yaml beside the manifest, pass --values, or set PHRONY_MANIFEST_VALUES`,
    );
  }
  return lines.join("\n");
}
