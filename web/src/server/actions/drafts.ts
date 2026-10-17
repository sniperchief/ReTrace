"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { FormState } from "@/lib/form-data";
import { readRepairForm, type RepairFormState } from "@/lib/repair-form";
import { notesSchema } from "@/lib/schemas/notes";
import { toFieldErrors } from "@/lib/schemas/common";
import { confirmDraft, createTextDraft, discardDraft, setEditedNotes } from "@/server/data/drafts";
import { NotFoundError } from "@/server/data/errors";
import { runExtraction, type ExtractionOutcome } from "@/server/extraction";
import { setFlash } from "@/server/flash";
import { requireTechnician } from "@/server/session";

function rethrowNotFound(error: unknown): never {
  if (error instanceof NotFoundError) notFound();
  throw error;
}

/** Typed notes instead of a voice note: creates a draft and opens the review page. */
export async function createTextDraftAction(
  generatorId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const technician = await requireTechnician();
  // Works with the AI off too: the rule-based extractor still fills the form.
  const values = { notes: String(formData.get("notes") ?? "") };
  const parsed = notesSchema.safeParse(values);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };

  let draftId: string;
  try {
    draftId = await createTextDraft(technician.id, generatorId, parsed.data.notes);
  } catch (error) {
    rethrowNotFound(error);
  }
  redirect(`/repairs/${draftId}/review`);
}

/** Runs extraction for a draft. Called by the review page; safe to call twice. */
export async function runExtractionAction(draftId: string, retry = false): Promise<ExtractionOutcome> {
  const technician = await requireTechnician();
  try {
    return await runExtraction(technician.id, draftId, { retry });
  } catch (error) {
    rethrowNotFound(error);
  }
}

/** Saves corrected notes (the original transcript is kept) and re-runs extraction. */
export async function correctNotesAction(draftId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const technician = await requireTechnician();
  const values = { notes: String(formData.get("notes") ?? "") };
  const parsed = notesSchema.safeParse(values);
  if (!parsed.success) return { errors: toFieldErrors(parsed.error), values };
  try {
    await setEditedNotes(technician.id, draftId, parsed.data.notes);
  } catch (error) {
    rethrowNotFound(error);
  }
  redirect(`/repairs/${draftId}/review`);
}

/**
 * The technician's explicit confirmation. Only now do the reviewed values
 * become a confirmed repair record.
 */
export async function confirmDraftAction(
  draftId: string,
  _prev: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  const technician = await requireTechnician();
  const form = readRepairForm(formData);
  if (formData.get("confirmed") !== "on") {
    const errors = form.ok ? {} : form.errors;
    return { errors: { ...errors, confirmed: ["confirmRequired"] }, values: form.values };
  }
  if (!form.ok) return { errors: form.errors, values: form.values };

  let generatorId: string;
  try {
    generatorId = await confirmDraft(technician.id, draftId, form.data);
  } catch (error) {
    rethrowNotFound(error);
  }
  revalidatePath(`/generators/${generatorId}`);
  revalidatePath("/repairs");
  await setFlash("repairSaved");
  redirect(`/repairs/${draftId}`);
}

export async function discardDraftAction(draftId: string): Promise<void> {
  const technician = await requireTechnician();
  let generatorId: string;
  try {
    generatorId = await discardDraft(technician.id, draftId);
  } catch (error) {
    rethrowNotFound(error);
  }
  revalidatePath(`/generators/${generatorId}`);
  await setFlash("draftDiscarded");
  redirect(`/generators/${generatorId}`);
}
