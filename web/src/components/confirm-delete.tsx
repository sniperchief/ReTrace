"use client";

import { useState, useTransition } from "react";
import { useMessages } from "@/i18n/client";
import { TrashIcon } from "./icons";
import { buttonStyles } from "./ui";

/** A delete button that asks first. Sits at the bottom of edit pages. */
export function ConfirmDelete({
  action,
  label,
  confirmText,
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
}) {
  const t = useMessages();
  const [asked, setAsked] = useState(false);
  const [pending, startTransition] = useTransition();
  const danger = `${buttonStyles.secondary} border-danger/40 text-danger hover:border-danger`;

  return (
    <section className="mt-10 border-t border-border pt-6" aria-label={t.danger.title}>
      {asked ? (
        <div role="alertdialog" aria-live="polite" className="rounded-card border border-danger/40 bg-danger-bg p-5">
          <p className="font-medium text-danger">{confirmText}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={pending} className={danger}
              onClick={() => startTransition(() => action())}>
              <TrashIcon size={16} /> {pending ? t.danger.deleting : label}
            </button>
            <button type="button" disabled={pending} className={buttonStyles.secondary} onClick={() => setAsked(false)}>
              {t.danger.keep}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={danger} onClick={() => setAsked(true)}>
          <TrashIcon size={16} /> {label}
        </button>
      )}
    </section>
  );
}
