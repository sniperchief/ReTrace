"use client";

import { useActionState } from "react";
import { errorMessage, interpolate } from "@/i18n";
import { useMessages } from "@/i18n/client";
import { SETUP_FLOW_FIELD, type FormState } from "@/lib/form-data";
import { fuelTypes, serviceIntervals } from "@/lib/schemas/generator";
import { Field, FormError, Select, SubmitButton, TextInput } from "./form";
import { LinkButton } from "./ui";

type Values = {
  customerId: string;
  label: string;
  brand: string;
  model: string;
  serialNumber: string;
  capacityKva: string;
  fuelType: string;
  location: string;
  serviceIntervalMonths: string;
};

export function GeneratorForm({
  action,
  initial,
  customers,
  cancelHref,
  setupFlow = false,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: Values;
  customers: { id: string; name: string }[];
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
  const optional = t.common.optional;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {setupFlow && <input type="hidden" name={SETUP_FLOW_FIELD} value="setup" />}
      <FormError message={err("_form")} />
      <Field id="customerId" label={t.generators.customer} error={err("customerId")}>
        <Select id="customerId" name="customerId" defaultValue={values.customerId} required
          invalid={!!err("customerId")}>
          <option value="">{t.generators.chooseCustomer}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Field id="label" label={t.generators.label} hint={t.generators.labelHint} error={err("label")}>
        <TextInput id="label" name="label" defaultValue={values.label} required maxLength={100}
          autoComplete="off" invalid={!!err("label")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="brand" label={t.generators.brand} optionalLabel={optional} error={err("brand")}>
          <TextInput id="brand" name="brand" defaultValue={values.brand} maxLength={60} invalid={!!err("brand")} />
        </Field>
        <Field id="model" label={t.generators.model} optionalLabel={optional} error={err("model")}>
          <TextInput id="model" name="model" defaultValue={values.model} maxLength={60} invalid={!!err("model")} />
        </Field>
        <Field id="serialNumber" label={t.generators.serialNumber} optionalLabel={optional} error={err("serialNumber")}>
          <TextInput id="serialNumber" name="serialNumber" defaultValue={values.serialNumber} maxLength={60}
            autoComplete="off" invalid={!!err("serialNumber")} />
        </Field>
        <Field id="capacityKva" label={t.generators.capacityKva} optionalLabel={optional} error={err("capacityKva")}>
          <TextInput id="capacityKva" name="capacityKva" inputMode="decimal" defaultValue={values.capacityKva}
            maxLength={10} invalid={!!err("capacityKva")} />
        </Field>
        <Field id="fuelType" label={t.generators.fuelType} optionalLabel={optional} error={err("fuelType")}>
          <Select id="fuelType" name="fuelType" defaultValue={values.fuelType} invalid={!!err("fuelType")}>
            <option value="">—</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>{t.generators.fuelTypes[f]}</option>
            ))}
          </Select>
        </Field>
        <Field id="location" label={t.generators.location} optionalLabel={optional} error={err("location")}>
          <TextInput id="location" name="location" defaultValue={values.location} maxLength={200}
            invalid={!!err("location")} />
        </Field>
      </div>
      <Field id="serviceIntervalMonths" label={t.service.interval} optionalLabel={optional}
        hint={t.service.intervalHint} error={err("serviceIntervalMonths")}>
        <Select id="serviceIntervalMonths" name="serviceIntervalMonths" defaultValue={values.serviceIntervalMonths}
          invalid={!!err("serviceIntervalMonths")}>
          <option value="">{t.service.none}</option>
          {serviceIntervals.map((n) => (
            <option key={n} value={n}>{n === 1 ? t.service.monthsOne : interpolate(t.service.months, { n })}</option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {cancelHref && <LinkButton href={cancelHref} variant="secondary">{t.common.cancel}</LinkButton>}
        <SubmitButton label={submitLabel ?? t.common.save} pendingLabel={t.common.saving} />
      </div>
    </form>
  );
}
