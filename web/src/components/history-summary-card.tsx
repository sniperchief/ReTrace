import Link from "next/link";
import { Fragment } from "react";
import { getMessages, interpolate } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { HistorySummary, SourceRef } from "@/lib/history-summary";
import { formatNaira } from "@/lib/money";

/** Links to the records a summary line came from. */
function Sources({ refs }: { refs: SourceRef[] }) {
  const t = getMessages();
  return (
    <span className="text-muted">
      {" ("}
      {refs.map((ref, i) => (
        <Fragment key={ref.id}>
          {i > 0 && ", "}
          <Link href={`/repairs/${ref.id}`} className="text-brand underline">
            {ref.date ? formatDate(ref.date) : t.repairs.undated}
          </Link>
        </Fragment>
      ))}
      {")"}
    </span>
  );
}

/**
 * The automatic summary, visibly separate from the recorded history itself.
 * Every statement links to its source records.
 */
export function HistorySummaryCard({ summary }: { summary: HistorySummary }) {
  const t = getMessages();
  const s = summary;
  const missing = (Object.keys(s.notRecorded) as (keyof typeof s.notRecorded)[]).filter((k) => s.notRecorded[k] > 0);

  return (
    <section aria-labelledby="summary-title" className="mb-6 rounded-xl border border-dashed border-brand/60 bg-brand/5 p-4">
      <h2 id="summary-title" className="font-semibold">{t.summary.title}</h2>
      <p className="mb-3 text-xs text-muted">
        {s.recordCount === 1 ? t.summary.disclaimerOne : interpolate(t.summary.disclaimer, { count: s.recordCount })}
      </p>

      <ul className="space-y-2 text-sm">
        <li>
          {s.firstDate && s.lastDate
            ? s.datedCount === 1
              ? interpolate(t.summary.spanOne, { date: formatDate(s.lastDate) })
              : interpolate(t.summary.span, { first: formatDate(s.firstDate), last: formatDate(s.lastDate) })
            : t.summary.noDates}
        </li>

        {s.latest && (
          <li>
            <span className="font-medium">{s.latest.ref.date ? t.summary.latest : t.summary.latestUndated}</span>
            <Sources refs={[s.latest.ref]} />
            <dl className="mt-1 space-y-0.5 pl-3">
              {(
                [
                  [t.repairs.reportedSymptoms, s.latest.reportedSymptoms],
                  [t.repairs.diagnosis, s.latest.diagnosis],
                  [t.repairs.workPerformed, s.latest.workPerformed],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="inline text-muted">{label}: </dt>
                  <dd className="inline break-words">
                    {value ?? <span className="text-muted italic">{t.common.notRecorded}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        )}

        <li>
          <span className="font-medium">{t.summary.partsTitle}</span>
          {s.parts.length === 0 ? (
            <p className="text-muted">{t.summary.partsNone}</p>
          ) : (
            <ul className="mt-1 space-y-0.5 pl-3">
              {s.parts.map((p) => (
                <li key={p.name.toLowerCase()} className="break-words">
                  {p.name}
                  {p.refs.length > 1 && ` ${interpolate(t.summary.times, { n: p.refs.length })}`}
                  <Sources refs={p.refs} />
                </li>
              ))}
            </ul>
          )}
        </li>

        <li>
          {s.charges.recordedCount === 0
            ? t.summary.chargesNone
            : interpolate(t.summary.charges, { n: s.charges.recordedCount, amount: formatNaira(s.charges.totalKobo) })}
        </li>

        {missing.length > 0 && (
          <li className="text-muted">
            {t.summary.notRecordedTitle}:{" "}
            {missing
              .map((k) =>
                interpolate(t.summary.notRecordedItem, {
                  field: t.summary.notRecorded[k],
                  n: s.notRecorded[k],
                  total: s.recordCount,
                }),
              )
              .join("; ")}
          </li>
        )}
      </ul>
    </section>
  );
}
