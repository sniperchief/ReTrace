import type { FieldErrors } from "@/lib/schemas/common";

export type FormState = {
  errors?: FieldErrors;
  values?: Record<string, string>;
};

/** Reads the named text fields from a form submission. Files are ignored. */
export function readFields(formData: FormData, names: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    out[name] = typeof value === "string" ? value : "";
  }
  return out;
}

export function readAll(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((v) => (typeof v === "string" ? v : ""));
}
