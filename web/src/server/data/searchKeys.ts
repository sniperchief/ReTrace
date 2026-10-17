import { phoneSearchKeys } from "@/lib/phone";
import { tokenize } from "@/lib/search";

type CustomerKeyFields = { name: string; phone: string | null };
type GeneratorKeyFields = {
  label: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
};

export function customerSearchKeys(c: CustomerKeyFields): string[] {
  return [...new Set([...tokenize(c.name), ...(c.phone ? phoneSearchKeys(c.phone) : [])])];
}

/** Generators are findable by their own details and by their owner's name/phone. */
export function generatorSearchKeys(g: GeneratorKeyFields, owner: CustomerKeyFields): string[] {
  return [
    ...new Set([
      ...tokenize(g.label, g.brand, g.model),
      ...(g.serialNumber ? [g.serialNumber.toLowerCase(), ...tokenize(g.serialNumber)] : []),
      ...customerSearchKeys(owner),
    ]),
  ];
}
