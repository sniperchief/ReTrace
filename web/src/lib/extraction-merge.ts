import type { ExtractionFlag } from "@/lib/extraction";
import type { PartInput, RepairFieldsInput } from "@/lib/schemas/repair";

/**
 * Combines the (validated) AI suggestion with the (validated) rule-based one.
 * For each field the AI's answer wins; where the AI left a field empty, or
 * its answer was removed by validation, the rules fill the gap. Both inputs
 * have already been checked against the notes, so the merge can't introduce
 * anything the notes don't support.
 */

export type FieldKey = "repairDate" | "reportedSymptoms" | "diagnosis" | "workPerformed" | "partsReplaced" | "totalCost" | "technicianNotes";
export type FieldSource = "ai" | "rules";
export type Engine = "ai" | "ai+rules" | "rules";

export type Validated = { fields: RepairFieldsInput; flags: ExtractionFlag[] };

export type Merged = {
  fields: RepairFieldsInput;
  flags: ExtractionFlag[];
  sources: Partial<Record<FieldKey, FieldSource>>;
  engine: Engine;
};

const SCALAR: Exclude<FieldKey, "partsReplaced" | "totalCost">[] = [
  "repairDate",
  "reportedSymptoms",
  "diagnosis",
  "workPerformed",
  "technicianNotes",
];

const firstWord = (name: string) => name.toLowerCase().split(/\s+/).find((w) => w.length >= 3) ?? name.toLowerCase();
const sameish = (a: string, b: string) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.includes(firstWord(y)) || y.includes(firstWord(x));
};

const flagField = (flag: ExtractionFlag): FieldKey =>
  flag.field.startsWith("partsReplaced") ? "partsReplaced" : (flag.field as FieldKey);

export function mergeSuggestions(ai: Validated | null, rules: Validated): Merged {
  if (!ai) {
    const sources: Merged["sources"] = {};
    for (const key of SCALAR) if (rules.fields[key]) sources[key] = "rules";
    if (rules.fields.partsReplaced.length) sources.partsReplaced = "rules";
    if (rules.fields.totalCostKobo !== null) sources.totalCost = "rules";
    return { fields: rules.fields, flags: rules.flags, sources, engine: "rules" };
  }

  const sources: Merged["sources"] = {};
  const fields: RepairFieldsInput = { ...ai.fields };

  for (const key of SCALAR) {
    if (ai.fields[key]) sources[key] = "ai";
    else if (rules.fields[key]) {
      (fields as Record<string, unknown>)[key] = rules.fields[key];
      sources[key] = "rules";
    }
  }

  if (ai.fields.totalCostKobo !== null) sources.totalCost = "ai";
  else if (rules.fields.totalCostKobo !== null) {
    fields.totalCostKobo = rules.fields.totalCostKobo;
    sources.totalCost = "rules";
  }

  if (ai.fields.partsReplaced.length) {
    // Keep the AI's parts; take a missing cost/quantity from the matching rule-found part,
    // and add parts the rules found that the AI missed.
    fields.partsReplaced = ai.fields.partsReplaced.map((part): PartInput => {
      const match = rules.fields.partsReplaced.find((r) => sameish(r.name, part.name));
      return match ? { ...part, costKobo: part.costKobo ?? match.costKobo, quantity: part.quantity ?? match.quantity } : part;
    });
    const missed = rules.fields.partsReplaced.filter((r) => !ai.fields.partsReplaced.some((p) => sameish(r.name, p.name)));
    fields.partsReplaced = [...fields.partsReplaced, ...missed];
    sources.partsReplaced = missed.length ? "rules" : "ai";
  } else if (rules.fields.partsReplaced.length) {
    fields.partsReplaced = rules.fields.partsReplaced;
    sources.partsReplaced = "rules";
  }

  // Keep a "left empty" flag only if the field is still empty after the merge.
  const stillEmpty = (key: FieldKey) =>
    key === "partsReplaced"
      ? sources.partsReplaced !== "rules"
      : key === "totalCost"
        ? fields.totalCostKobo === null
        : !(fields as Record<string, unknown>)[key];
  const flags = ai.flags.filter((f) => stillEmpty(flagField(f)));

  const usedRules = Object.values(sources).includes("rules");
  return { fields, flags, sources, engine: usedRules ? "ai+rules" : "ai" };
}
