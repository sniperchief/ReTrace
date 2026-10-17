"use client";

import { useActionState } from "react";
import { errorMessage } from "@/i18n";
import { useMessages } from "@/i18n/client";
import { SETUP_FLOW_FIELD, type FormState } from "@/lib/form-data";
import { Field, FormError, SubmitButton, TextArea, TextInput } from "./form";
import { LinkButton } from "./ui";

type Values = { name: string; phone: string; location: string; notes: string };

export function CustomerForm({
  action,
  initial,
  cancelHref,
  setupFlow = false,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: Values;
  /** Omit to hide Cancel (the setup flow has its own "Skip for now"). */
  cancelHref?: string;
  /** Submitted from the first-run setup flow: return to it after saving. */
  setupFlow?: boolean;
  submitLabel?: string;
}) {
  const t = useMessages();
  const [state, formAction] = useActionState(action, {});
  const values = { ...initial, ...state.values };
  const err = (field: string) =>
    state.errors?.[field] ? errorMessage(t, state.errors[field]?.[0]) : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {setupFlow && <input type="hidden" name={SETUP_FLOW_FIELD} value="setup" />}
      <FormError message={err("_form")} />
      <Field id="name" label={t.customers.name} error={err("name")}>
        <TextInput id="name" name="name" defaultValue={values.name} required maxLength={100}
          autoComplete="off" invalid={!!err("name")} />
      </Field>
      <Field id="phone" label={t.customers.phone} optionalLabel={t.common.optional} error={err("phone")}>
        <TextInput id="phone" name="phone" type="tel" inputMode="tel" defaultValue={values.phone}
          maxLength={20} autoComplete="off" invalid={!!err("phone")} />
      </Field>
      <Field id="location" label={t.customers.location} optionalLabel={t.common.optional}
        hint={t.customers.locationHint} error={err("location")}>
        <TextInput id="location" name="location" defaultValue={values.location} maxLength={200}
          invalid={!!err("location")} />
      </Field>
      <Field id="notes" label={t.customers.notes} optionalLabel={t.common.optional} error={err("notes")}>
        <TextArea id="notes" name="notes" defaultValue={values.notes} maxLength={2000} invalid={!!err("notes")} />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {cancelHref && <LinkButton href={cancelHref} variant="secondary">{t.common.cancel}</LinkButton>}
        <SubmitButton label={submitLabel ?? t.common.save} pendingLabel={t.common.saving} />
      </div>
    </form>
  );
}
