"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { readRepairForm, type RepairFormState } from "@/lib/repair-form";
import { NotFoundError } from "@/server/data/errors";
import { createRepair, updateRepair } from "@/server/data/repairs";
import { requireTechnician } from "@/server/session";

export async function createRepairAction(
  generatorId: string,
  _prev: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  const technician = await requireTechnician();
  const form = readRepairForm(formData);
  if (!form.ok) return { errors: form.errors, values: form.values };

  let repairId: string;
  try {
    repairId = (await createRepair(technician.id, generatorId, form.data)).id;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  revalidatePath(`/generators/${generatorId}`);
  revalidatePath("/repairs");
  redirect(`/repairs/${repairId}`);
}

export async function updateRepairAction(
  repairId: string,
  _prev: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  const technician = await requireTechnician();
  const form = readRepairForm(formData);
  if (!form.ok) return { errors: form.errors, values: form.values };

  let generatorId: string;
  try {
    generatorId = (await updateRepair(technician.id, repairId, form.data)).generatorId;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  revalidatePath(`/generators/${generatorId}`);
  revalidatePath("/repairs");
  redirect(`/repairs/${repairId}`);
}
