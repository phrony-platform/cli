import Table from "cli-table3";
import pc from "picocolors";
import type { ManifestPlanRowDto, ManifestPlanTableDto } from "./manifest-plan-dto.js";

type PlanPresentation = NonNullable<ManifestPlanTableDto["presentation"]>;

function actionToken(action: ManifestPlanRowDto["action"], presentation: PlanPresentation): string {
  if (presentation === "structural_diff") {
    switch (action) {
      case "CREATE":
        return pc.green("+");
      case "UPDATE":
        return pc.yellow("~");
      case "DELETE":
        return pc.cyan("›");
      case "NO_OP":
        return pc.dim(" ");
      default:
        return "?";
    }
  }
  switch (action) {
    case "CREATE":
      return pc.green("+");
    case "UPDATE":
      return pc.yellow("~");
    case "DELETE":
      return pc.red("-");
    case "NO_OP":
      return pc.dim(" ");
    default:
      return "?";
  }
}

function actionLabel(action: ManifestPlanRowDto["action"], presentation: PlanPresentation): string {
  if (presentation === "structural_diff") {
    switch (action) {
      case "CREATE":
        return pc.green("local only");
      case "UPDATE":
        return pc.yellow("changed");
      case "DELETE":
        return pc.cyan("remote only");
      case "NO_OP":
        return pc.dim("same");
      default:
        return String(action);
    }
  }
  switch (action) {
    case "CREATE":
      return pc.green("create");
    case "UPDATE":
      return pc.yellow("update");
    case "DELETE":
      return pc.red("delete");
    case "NO_OP":
      return pc.dim("no-op");
    default:
      return String(action);
  }
}

/** Terraform-style table: action, resource type, logical key, optional message / details. */
export function renderManifestPlanTable(dto: ManifestPlanTableDto): string {
  const presentation: PlanPresentation = dto.presentation ?? "plan";
  const lines: string[] = [];
  if (presentation === "structural_diff") {
    lines.push(pc.bold("Manifest diff"));
    lines.push(
      pc.dim("Local files vs exported manifest subtree (read-only; not an apply preview)."),
    );
  } else {
    lines.push(pc.bold("Manifest changes"));
  }
  lines.push("");

  const table = new Table({
    head: [pc.bold(""), pc.bold("Action"), pc.bold("Resource"), pc.bold("Key"), pc.bold("Detail")],
    style: { head: [], border: [] },
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: " ",
    },
  });

  for (const row of dto.changes) {
    const detail =
      [row.message, ...(row.details ?? []).slice(0, 8)].filter(Boolean).join("\n") || "";
    table.push([
      actionToken(row.action, presentation),
      actionLabel(row.action, presentation),
      row.resource,
      row.key,
      detail,
    ]);
  }

  lines.push(table.toString());

  if (presentation === "structural_diff") {
    lines.push("");
    lines.push(
      pc.dim(
        '"Remote only" means the export has a resource your local files do not; it is not an instruction to remove anything.',
      ),
    );
  }

  if (dto.warnings?.length) {
    lines.push("");
    lines.push(pc.yellow(pc.bold("Warnings")));
    for (const w of dto.warnings) {
      lines.push(`  ${pc.yellow("!")} ${w}`);
    }
  }

  if (dto.servicesNeedingConnection?.length) {
    lines.push("");
    lines.push(pc.cyan(pc.bold("Services needing connection")));
    const t2 = new Table({
      head: [pc.bold("Service id"), pc.bold("Name"), pc.bold("Manifest key")],
      style: { head: [], border: [] },
      chars: {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        right: "",
        "right-mid": "",
        middle: " ",
      },
    });
    for (const s of dto.servicesNeedingConnection) {
      t2.push([s.serviceId, s.name, s.manifestKey ?? ""]);
    }
    lines.push(t2.toString());
  }

  return lines.join("\n");
}
