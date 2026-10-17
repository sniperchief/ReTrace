"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isSetupFlow, readFields, type FormState } from "@/lib/form-data";
import { toFieldErrors } from "@/lib/schemas/common";
import { generatorInputSchema } from "@/lib/schemas/generator";
import { ConflictError, NotFoundError } from "@/server/data/errors";
import { createGenerator, updateGenerator } from "@/server/data/generators";
import { requireTechnician } from "@/server/session";

const FIELDS = [
  "customerId",
  "label",
  "brand",
  "model",
  "serialNumber",
  "capacityKva",
  "fuelType",
  "location",
] as const;

async function save(generatorId: string | null, formData: FormData): Promise<FormState> {
  const technician = await requireTechnician();
  const values = readFields(formData, FIELDS);
  const parsed = generatorInputSchema.safeParse(values);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  let id: string;
  try {
    id = generatorId
      ? (await updateGenerator(technician.id, generatorId, parsed.data)).id
      : (await createGenerator(technician.id, parsed.data)).id;
  } catch (error) {
    if (error instanceof ConflictError) return { errors: { [error.field]: [error.code] }, values };
    if (error instanceof NotFoundError) {
      // A customer id from the form that isn't ours is a field error; a
      // generator that isn't ours is a 404.
      if (error.entity === "customer") return { errors: { customerId: ["notFound"] }, values };
      notFound();
    }
    throw error;
  }
  revalidatePath("/generators");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  // Only new generators come from the setup flow; edits always return to the generator.
  redirect(!generatorId && isSetupFlow(formData) ? "/welcome" : `/generators/${id}`);
}

export async function createGeneratorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return save(null, formData);
}

export async function updateGeneratorAction(
  generatorId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return save(generatorId, formData);
}
