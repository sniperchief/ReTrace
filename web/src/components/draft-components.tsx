"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { errorMessage } from "@/i18n";
import { useMessages } from "@/i18n/client";
import type { FormState } from "@/lib/form-data";
import { MAX_NOTES_CHARS } from "@/lib/schemas/notes";
import type { ExtractionOutcome } from "@/server/extraction";
import { Field, FormError, SubmitButton, TextArea } from "./form";
import { buttonStyles } from "./ui";

type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Typed notes → AI-filled draft (alternative to a voice note). */
export function NotesForm({
  action,
  label,
  hint,
  submitLabel,
  initialNotes = "",
}: {
  action: FormAction;
  label: string;
  hint: string;
  submitLabel: string;
  initialNotes?: string;
}) {
  const t = useMessages();
  const [state, formAction] = useActionState(action, {});
  const err = state.errors?.notes ? errorMessage(t, state.errors.notes[0]) : undefined;
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormError message={state.errors?._form ? errorMessage(t, state.errors._form[0]) : undefined} />
      <Field id="notes" label={label} hint={hint} error={err}>
        <TextArea id="notes" name="notes" rows={6} maxLength={MAX_NOTES_CHARS}
          defaultValue={state.values?.notes ?? initialNotes} invalid={!!err} />
      </Field>
      <SubmitButton label={submitLabel} pendingLabel={t.common.saving} />
    </form>
  );
}

/**
 * Starts extraction once when the review page opens with notes but no
 * suggestion yet, then refreshes the page to show the result.
 */
export function ExtractionRunner({
  run,
}: {
  run: () => Promise<ExtractionOutcome>;
}) {
  const t = useMessages();
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run()
      .catch(() => undefined)
      .finally(() => router.refresh());
  }, [run, router]);

  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-4" aria-live="polite">
      <span className="size-3 shrink-0 animate-ping rounded-full bg-foreground" />
      <p className="text-sm">{t.review.extracting}</p>
    </div>
  );
}

/** Explicit retry after a failed extraction. */
export function RetryButton({ run, label }: { run: () => Promise<ExtractionOutcome>; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonStyles.secondary}
      onClick={() =>
        startTransition(async () => {
          await run().catch(() => undefined);
          router.refresh();
        })
      }
    >
      {pending ? "…" : label}
    </button>
  );
}

export function DiscardDraftButton({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
}) {
  const [pending, startTransition] = useTransition();
  const [asked, setAsked] = useState(false);
  return asked ? (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>{confirmText}</span>
      <button type="button" disabled={pending} className={`${buttonStyles.secondary} text-danger`}
        onClick={() => startTransition(() => action())}>
        {label}
      </button>
      <button type="button" className={buttonStyles.ghost} onClick={() => setAsked(false)}>✕</button>
    </div>
  ) : (
    <button type="button" className={`${buttonStyles.ghost} text-danger`} onClick={() => setAsked(true)}>
      {label}
    </button>
  );
}
