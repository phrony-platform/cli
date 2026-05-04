import type {
  ManifestApplyResult,
  ManifestChangeAction,
  ManifestChangeResource,
  ManifestServiceNeedingConnection,
} from "../schema/manifest-apply-result.schemas.js";

/** One row in the human / JSON plan output (API plan or structural manifest diff). */
export type ManifestPlanRowDto = {
  action: ManifestChangeAction;
  resource: ManifestChangeResource;
  key: string;
  message?: string;
  /** Optional field-level lines for structural diff / future API deltas. */
  details?: string[];
};

export type ManifestPlanTableDto = {
  changes: ManifestPlanRowDto[];
  warnings?: string[];
  servicesNeedingConnection?: ManifestServiceNeedingConnection[];
  dryRun?: boolean;
  rootAgentId?: string;
  /**
   * `structural_diff`: read-only `phrony diff` — row actions describe local vs remote export,
   * not apply intent (e.g. remote-only rows are not “deletes”).
   */
  presentation?: "plan" | "structural_diff";
};

export function manifestApplyResultToDto(result: ManifestApplyResult): ManifestPlanTableDto {
  return {
    dryRun: result.dryRun,
    rootAgentId: result.rootAgentId,
    changes: result.changes.map((c) => ({
      action: c.action,
      resource: c.resource,
      key: c.key,
      message: c.message,
    })),
    warnings: result.warnings,
    servicesNeedingConnection: result.servicesNeedingConnection,
  };
}
