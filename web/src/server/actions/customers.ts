"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isSetupFlow, readFields, type FormState } from "@/lib/form-data";
import { toFieldErrors } from "@/lib/schemas/common";
import { customerInputSchema } from "@/lib/schemas/customer";
import { createCustomer, updateCustomer } from "@/server/data/customers";
import { NotFoundError } from "@/server/data/errors";
import { requireTechnician } from "@/server/session";

const FIELDS = ["name", "phone", "location", "notes"] as const;

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const technician = await requireTechnician();
  const values = readFields(formData, FIELDS);
  const parsed = customerInputSchema.safeParse(values);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  const customer = await createCustomer(technician.id, parsed.data);
  revalidatePath("/customers");
  redirect(isSetupFlow(formData) ? "/welcome" : `/customers/${customer.id}`);
}

export async function updateCustomerAction(
  customerId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const technician = await requireTechnician();
  const values = readFields(formData, FIELDS);
  const parsed = customerInputSchema.safeParse(values);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  try {
    await updateCustomer(technician.id, customerId, parsed.data);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  revalidatePath("/customers");
  revalidatePath("/generators");
  redirect(`/customers/${customerId}`);
}
