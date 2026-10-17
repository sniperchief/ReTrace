import { z } from "zod";
import { objectIdSchema, optionalNumber, optionalText, requiredText } from "./common";

export const fuelTypes = ["petrol", "diesel", "gas", "other"] as const;
export type FuelType = (typeof fuelTypes)[number];

/** Choices offered for "Service every N months". */
export const serviceIntervals = [1, 2, 3, 4, 6, 12] as const;

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
  /** Months between services; drives the "due for service" list. Blank = no reminders. */
  serviceIntervalMonths: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number("invalid").int("invalid").min(1, "invalid").max(24, "invalid").nullable(),
  ),
});

// The interval is optional for callers (older code and tests); blank means no reminders.
export type GeneratorInput = Omit<z.output<typeof generatorInputSchema>, "serviceIntervalMonths"> & {
  serviceIntervalMonths?: number | null;
};
