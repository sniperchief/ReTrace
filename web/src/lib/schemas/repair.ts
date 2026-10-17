import { z } from "zod";
import {
  objectIdSchema,
  optionalDateOnly,
  optionalNairaAmount,
  optionalNumber,
  optionalText,
  requiredText,
} from "./common";

export const MAX_PARTS = 30;

export const partInputSchema = z.object({
  name: requiredText(100),
  quantity: optionalNumber(1, 1000, "invalidQuantity").refine(
    (q) => q === null || Number.isInteger(q),
    "invalidQuantity",
  ),
  costKobo: optionalNairaAmount,
});

/** Editable repair fields. Every field may be unknown (null). */
export const repairFieldsSchema = z
  .object({
    repairDate: optionalDateOnly,
    reportedSymptoms: optionalText(4000),
    diagnosis: optionalText(4000),
    workPerformed: optionalText(4000),
    partsReplaced: z.array(partInputSchema).max(MAX_PARTS, "tooManyParts").default([]),
    totalCostKobo: optionalNairaAmount,
    technicianNotes: optionalText(4000),
  })
  .refine(
    (r) =>
      Boolean(
        r.reportedSymptoms ||
          r.diagnosis ||
          r.workPerformed ||
          r.technicianNotes ||
          r.partsReplaced.length,
      ),
    { message: "emptyRecord", path: ["_form"] },
  );

export const repairCreateSchema = z.object({
  generatorId: objectIdSchema,
  fields: repairFieldsSchema,
});

export type RepairFieldsInput = z.output<typeof repairFieldsSchema>;
export type PartInput = z.output<typeof partInputSchema>;
