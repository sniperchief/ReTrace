import { z } from "zod";
import { objectIdSchema, optionalNumber, optionalText, requiredText } from "./common";

export const fuelTypes = ["petrol", "diesel", "gas", "other"] as const;
export type FuelType = (typeof fuelTypes)[number];

export const generatorInputSchema = z.object({
  customerId: objectIdSchema,
  label: requiredText(100),
  brand: optionalText(60),
  model: optionalText(60),
  serialNumber: optionalText(60),
  capacityKva: optionalNumber(0.1, 5000),
  fuelType: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.enum(fuelTypes, "invalid").nullable(),
  ),
  location: optionalText(200),
});

export type GeneratorInput = z.output<typeof generatorInputSchema>;
