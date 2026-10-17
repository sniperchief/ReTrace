"use client";

import { useActionState, useState } from "react";
import { errorMessage } from "@/i18n";
import { useMessages } from "@/i18n/client";
import type { PartValues, RepairFormState, RepairFormValues } from "@/lib/repair-form";
import { MAX_PARTS } from "@/lib/schemas/repair";
import { Field, FormError, SubmitButton, TextArea, TextInput } from "./form";
import { buttonStyles, LinkButton } from "./ui";

type Row = PartValues & { key: number };

let nextKey = 0;
const toRows = (parts: PartValues[]): Row[] => parts.map((p) => ({ ...p, key: nextKey++ }));

export function RepairForm({
  action,
  initial,
  cancelHref,
  submitLabel,
  confirmLabel,
}: {
  action: (prev: RepairFormState, formData: FormData) => Promise<RepairFormState>;
  initial: RepairFormValues;
  cancelHref: string;
  submitLabel?: string;
  /** When set, the technician must tick this box before the record is saved. */
  confirmLabel?: string;
}) {
  const t = useMessages();
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? initial;
  const err = (field: string) =>
    state.errors?.[field] ? errorMessage(t, state.errors[field]?.[0]) : undefined;
  const optional = t.common.optional;

  // Rows are reset from the server's echo after each failed submit.
  const [rows, setRows] = useState<Row[]>(() => toRows(initial.parts));
  const [echo, setEcho] = useState(state.values);
  if (state.values !== echo) {
    setEcho(state.values);
    if (state.values) setRows(toRows(state.values.parts));
  }

  const textArea = (name: keyof RepairFormValues, label: string, hint?: string) => (
    <Field id={name} label={label} optionalLabel={optional} hint={hint} error={err(name)}>
      <TextArea id={name} name={name} defaultValue={values[name] as string} maxLength={4000}
        invalid={!!err(name)} />
    </Field>
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={err("_form")} />
      <Field id="repairDate" label={t.repairs.repairDate} optionalLabel={optional} error={err("repairDate")}>
        <TextInput id="repairDate" name="repairDate" type="date" defaultValue={values.repairDate}
          invalid={!!err("repairDate")} />
      </Field>
      {textArea("reportedSymptoms", t.repairs.reportedSymptoms, t.repairs.reportedSymptomsHint)}
      {textArea("diagnosis", t.repairs.diagnosis, t.repairs.diagnosisHint)}
      {textArea("workPerformed", t.repairs.workPerformed)}

      <fieldset className="space-y-3 rounded-card border border-border p-3">
        <legend className="px-1 text-sm font-medium">
          {t.repairs.partsReplaced} <span className="font-normal text-muted">({optional})</span>
        </legend>
        {err("partsReplaced") && <p className="text-sm text-danger">{err("partsReplaced")}</p>}
        {rows.map((row, i) => {
          const nameErr = err(`partsReplaced.${i}.name`);
          const qtyErr = err(`partsReplaced.${i}.quantity`);
          const costErr = err(`partsReplaced.${i}.costKobo`);
          return (
            <div key={row.key} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="grid grid-cols-[1fr_4.5rem] gap-2">
                <Field id={`partName-${row.key}`} label={t.repairs.partName} error={nameErr}>
                  <TextInput id={`partName-${row.key}`} name="partName" defaultValue={row.name}
                    maxLength={100} invalid={!!nameErr} />
                </Field>
                <Field id={`partQuantity-${row.key}`} label={t.repairs.partQuantity} error={qtyErr}>
                  <TextInput id={`partQuantity-${row.key}`} name="partQuantity" inputMode="numeric"
                    defaultValue={row.quantity} maxLength={4} invalid={!!qtyErr} />
                </Field>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <Field id={`partCost-${row.key}`} label={t.repairs.partCost} error={costErr}>
                  <TextInput id={`partCost-${row.key}`} name="partCost" inputMode="decimal"
                    defaultValue={row.cost} maxLength={15} invalid={!!costErr} />
                </Field>
                <button type="button" className={buttonStyles.ghost}
                  onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}>
                  {t.repairs.removePart}
                </button>
              </div>
            </div>
          );
        })}
        {rows.length < MAX_PARTS && (
          <button type="button" className={buttonStyles.secondary}
            onClick={() => setRows((r) => [...r, ...toRows([{ name: "", quantity: "", cost: "" }])])}>
            + {t.repairs.addPart}
          </button>
        )}
      </fieldset>

      <Field id="totalCost" label={t.repairs.totalCost} optionalLabel={optional} error={err("totalCost")}>
        <TextInput id="totalCost" name="totalCost" inputMode="decimal" defaultValue={values.totalCost}
          maxLength={15} invalid={!!err("totalCost")} />
      </Field>
      {textArea("technicianNotes", t.repairs.technicianNotes)}

      {confirmLabel && (
        <div className="rounded-card border border-line-strong bg-tint p-3">
          <label className="flex items-start gap-3 text-sm font-medium">
            <input type="checkbox" name="confirmed" required className="mt-0.5 size-5 shrink-0 accent-foreground"
              aria-invalid={!!err("confirmed") || undefined} aria-describedby={err("confirmed") ? "confirmed-error" : undefined} />
            {confirmLabel}
          </label>
          {err("confirmed") && <p id="confirmed-error" className="mt-1 text-sm text-danger">{err("confirmed")}</p>}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton href={cancelHref} variant="secondary">{t.common.cancel}</LinkButton>
        <SubmitButton label={submitLabel ?? t.common.save} pendingLabel={t.common.saving} />
      </div>
    </form>
  );
}
