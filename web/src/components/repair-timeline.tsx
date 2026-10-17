import Link from "next/link";
import { getMessages } from "@/i18n";
import { formatDate } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import type { Repair } from "@/server/data/repairs";

/**
 * A generator's confirmed repairs as a timeline: newest first, undated
 * records grouped last. Fields that weren't recorded say so, rather than
 * being left out silently or filled with a guess.
 */
export function RepairTimeline({ repairs }: { repairs: Repair[] }) {
  const t = getMessages();
  const dated = repairs.filter((r) => r.repairDate);
  const undated = repairs.filter((r) => !r.repairDate);

  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {dated.map((r) => (
        <TimelineItem key={r.id} repair={r} heading={formatDate(r.repairDate!)} />
      ))}
      {undated.length > 0 && (
        <>
          <li className="-ml-5 pt-2 text-xs font-bold text-muted">{t.timeline.undatedGroup}</li>
          {undated.map((r) => (
            <TimelineItem key={r.id} repair={r} heading={t.repairs.undated} />
          ))}
        </>
      )}
    </ol>
  );
}

function TimelineItem({ repair, heading }: { repair: Repair; heading: string }) {
  const t = getMessages();
  const notRecorded = <span className="text-muted italic">{t.common.notRecorded}</span>;
  const rows = [
    { label: t.repairs.reportedSymptoms, value: repair.reportedSymptoms },
    { label: t.repairs.diagnosis, value: repair.diagnosis },
    { label: t.repairs.workPerformed, value: repair.workPerformed },
  ];

  return (
    <li className="relative">
      <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-background bg-foreground" aria-hidden />
      <article className="rounded-card border border-border bg-surface p-4">
        <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="font-bold">
            <Link href={`/repairs/${repair.id}`} className="hover:underline">
              {heading}
            </Link>
          </h3>
          {repair.totalCostKobo !== null && (
            <span className="text-sm font-medium">{formatNaira(repair.totalCostKobo)}</span>
          )}
        </header>
        <dl className="space-y-1 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[7.5rem_1fr] gap-2">
              <dt className="text-muted">{row.label}</dt>
              <dd className="break-words whitespace-pre-line">{row.value ?? notRecorded}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[7.5rem_1fr] gap-2">
            <dt className="text-muted">{t.repairs.partsReplaced}</dt>
            <dd className="break-words">
              {repair.partsReplaced.length === 0 ? (
                <span className="text-muted italic">{t.timeline.noParts}</span>
              ) : (
                <ul>
                  {repair.partsReplaced.map((p, i) => (
                    <li key={i}>
                      {p.name}
                      {p.quantity !== null && p.quantity !== 1 ? ` ×${p.quantity}` : ""}
                      {p.costKobo !== null ? ` · ${formatNaira(p.costKobo)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
        <Link href={`/repairs/${repair.id}`} className="mt-2 inline-block text-sm text-foreground underline underline-offset-2">
          {t.timeline.open}
        </Link>
      </article>
    </li>
  );
}
