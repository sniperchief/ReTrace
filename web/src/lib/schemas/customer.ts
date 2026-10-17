import { z } from "zod";
import { optionalPhone, optionalText, requiredText } from "./common";

export const customerInputSchema = z.object({
  name: requiredText(100),
  phone: optionalPhone,
  location: optionalText(200),
  notes: optionalText(2000),
});

export type CustomerInput = z.output<typeof customerInputSchema>;
