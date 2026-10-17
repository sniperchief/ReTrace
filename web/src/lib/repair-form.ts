import { readAll, readFields } from "@/lib/form-data";
import { koboToInput } from "@/lib/money";
import { toFieldErrors, type FieldErrors } from "@/lib/schemas/common";
import { MAX_PARTS, repairFieldsSchema, type RepairFieldsInput } from "@/lib/schemas/repair";

export const REPAIR_FIELDS = [
  "repairDate",
  "reportedSymptoms",
  "diagnosis",
  "workPerformed",
  "totalCost",
  "technicianNotes",
] as const;

export type PartValues = { name: string; quantity: string; cost: string };
export type RepairFormValues = Record<(typeof REPAIR_FIELDS)[number], string> & { parts: PartValues[] };
export type RepairFormState = { errors?: FieldErrors; values?: RepairFormValues };

/** Pre-fills the form from stored/suggested values. Unknown values stay blank. */
export function toRepairFormValues(fields: RepairFieldsInput | null, defaults: { repairDate?: string } = {}): RepairFormValues {
  const naira = (kobo: number | null | undefined) => koboToInput(kobo);
  return {
    repairDate: fields?.repairDate ? fields.repairDate.toISOString().slice(0, 10) : (defaults.repairDate ?? ""),
    reportedSymptoms: fields?.reportedSymptoms ?? "",
    diagnosis: fields?.diagnosis ?? "",
    workPerformed: fields?.workPerformed ?? "",
    totalCost: naira(fields?.totalCostKobo),
    technicianNotes: fields?.technicianNotes ?? "",
    parts: (fields?.partsReplaced ?? []).map((p) => ({
      name: p.name,
      quantity: p.quantity?.toString() ?? "",
      cost: naira(p.costKobo),
    })),
  };
}

type ReadResult =
  | { ok: true; data: RepairFieldsInput; values: RepairFormValues }
  | { ok: false; errors: FieldErrors; values: RepairFormValues };

/** Reads and validates the repair form. Part rows are parallel `partName`/`partQuantity`/`partCost` inputs. */
export function readRepairForm(formData: FormData): ReadResult {
  const values = readFields(formData, REPAIR_FIELDS) as Record<(typeof REPAIR_FIELDS)[number], string>;
  const names = readAll(formData, "partName");
  const quantities = readAll(formData, "partQuantity");
  const costs = readAll(formData, "partCost");
  const parts: PartValues[] = names
    .slice(0, MAX_PARTS + 1) // one extra so the "too many parts" error can fire
    .map((name, i) => ({ name, quantity: quantities[i] ?? "", cost: costs[i] ?? "" }))
    .filter((p) => p.name.trim() || p.quantity.trim() || p.cost.trim());

  const parsed = repairFieldsSchema.safeParse({
    repairDate: values.repairDate,
    reportedSymptoms: values.reportedSymptoms,
    diagnosis: values.diagnosis,
    workPerformed: values.workPerformed,
    partsReplaced: parts.map((p) => ({ name: p.name, quantity: p.quantity, costKobo: p.cost })),
    totalCostKobo: values.totalCost,
    technicianNotes: values.technicianNotes,
  });
  const formValues = { ...values, parts };
  if (!parsed.success) {
    const errors = toFieldErrors(parsed.error);
    // The input for total cost is named "totalCost".
    if (errors.totalCostKobo) errors.totalCost = errors.totalCostKobo;
    return { ok: false, errors, values: formValues };
  }
  return { ok: true, data: parsed.data, values: formValues };
}
