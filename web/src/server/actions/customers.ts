"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { isSetupFlow, readFields, type FormState } from "@/lib/form-data";
import { toFieldErrors } from "@/lib/schemas/common";
import { customerInputSchema } from "@/lib/schemas/customer";
import { createCustomer, deleteCustomer, updateCustomer } from "@/server/data/customers";
import { ConflictError, NotFoundError } from "@/server/data/errors";
import { setFlash } from "@/server/flash";
import { requireTechnician } from "@/server/session";

const FIELDS = ["name", "phone", "location", "notes"] as const;

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const technician = await requireTechnician();
  const values = readFields(formData, FIELDS);
  const parsed = customerInputSchema.safeParse(values);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  const customer = await createCustomer(technician.id, parsed.data);
  revalidatePath("/customers");
  await setFlash("customerSaved");
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
  await setFlash("customerSaved");
  redirect(`/customers/${customerId}`);
}

/** Refused while the customer still has generators (the page explains why). */
export async function deleteCustomerAction(customerId: string): Promise<void> {
  const technician = await requireTechnician();
  try {
    await deleteCustomer(technician.id, customerId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ConflictError) redirect(`/customers/${customerId}`);
    throw error;
  }
  revalidatePath("/customers");
  await setFlash("customerDeleted");
  redirect("/customers");
}
