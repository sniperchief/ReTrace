import Link from "next/link";
import { getMessages, errorMessage, interpolate } from "@/i18n";
import type { FieldErrors } from "@/lib/schemas/common";
import { buttonStyles, inputClass as input } from "./ui";

type Values = { q?: string; part?: string; from?: string; to?: string; generator?: string };

/** Plain GET form so searches are shareable URLs and work without JavaScript. */
export function RepairSearchForm({
  values,
  errors = {},
  generatorLabel,
}: {
  values: Values;
  errors?: FieldErrors;
  generatorLabel?: string;
}) {
  const t = getMessages();
  const err = (k: string) => (errors[k] ? errorMessage(t, errors[k]![0]) : undefined);

  return (
    <form action="/repairs" method="get" role="search" className="mb-5 space-y-3 rounded-card border border-border bg-surface p-4">
      {values.generator && generatorLabel && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="generator" value={values.generator} />
          <span className="rounded-full bg-tint px-3 py-1 text-foreground">
            {interpolate(t.search.onlyGenerator, { label: generatorLabel })}
          </span>
        </p>
      )}
      <div className="space-y-1">
        <label htmlFor="q" className="block text-sm font-medium">{t.search.keywords}</label>
        <input id="q" name="q" type="search" defaultValue={values.q} maxLength={100}
          placeholder={t.search.keywordsPlaceholder} className={input} />
        {err("q") && <p className="text-sm text-danger">{err("q")}</p>}
      </div>
      <details open={Boolean(values.part || values.from || values.to)}>
        <summary className="cursor-pointer text-sm text-muted">{t.search.part} · {t.search.from} / {t.search.to}</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="part" className="block text-sm font-medium">{t.search.part}</label>
            <input id="part" name="part" defaultValue={values.part} maxLength={60}
              placeholder={t.search.partPlaceholder} className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="from" className="block text-sm font-medium">{t.search.from}</label>
            <input id="from" name="from" type="date" defaultValue={values.from} className={input} />
            {err("from") && <p className="text-sm text-danger">{err("from")}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="to" className="block text-sm font-medium">{t.search.to}</label>
            <input id="to" name="to" type="date" defaultValue={values.to} className={input} />
            {err("to") && <p className="text-sm text-danger">{err("to")}</p>}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{t.search.dateFilterHint}</p>
      </details>
      <p className="text-xs text-muted">{t.search.filtersHint}</p>
      <div className="flex gap-2">
        <button type="submit" className={buttonStyles.primary}>{t.search.submit}</button>
        <Link href={values.generator && generatorLabel ? `/repairs?generator=${values.generator}` : "/repairs"}
          className={buttonStyles.secondary}>
          {t.search.clear}
        </Link>
      </div>
    </form>
  );
}
