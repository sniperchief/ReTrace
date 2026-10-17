import Link from "next/link";
import { getMessages } from "@/i18n";
import { formatDate } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import type { Repair } from "@/server/data/repairs";

/** One entry in a repair history or list. */
export function RepairSummary({
  repair,
  subtitle,
  footnote,
}: {
  repair: Repair;
  subtitle?: string;
  footnote?: string;
}) {
  const t = getMessages();
  const lines = [
    { label: t.repairs.reportedSymptoms, value: repair.reportedSymptoms },
    { label: t.repairs.diagnosis, value: repair.diagnosis },
    { label: t.repairs.workPerformed, value: repair.workPerformed },
  ].filter((l) => l.value);
  const parts = repair.partsReplaced.map((p) => (p.quantity && p.quantity > 1 ? `${p.name} ×${p.quantity}` : p.name));

  return (
    <Link href={`/repairs/${repair.id}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-brand">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-semibold">
          {repair.repairDate ? formatDate(repair.repairDate) : t.repairs.undated}
        </p>
        {repair.totalCostKobo !== null && (
          <p className="text-sm font-medium">{formatNaira(repair.totalCostKobo)}</p>
        )}
      </div>
      {subtitle && <p className="text-sm text-muted break-words">{subtitle}</p>}
      <dl className="mt-2 space-y-1 text-sm">
        {lines.map((l) => (
          <div key={l.label}>
            <dt className="inline font-medium">{l.label}: </dt>
            <dd className="inline line-clamp-3 break-words whitespace-pre-line text-muted">{l.value}</dd>
          </div>
        ))}
        {parts.length > 0 && (
          <div>
            <dt className="inline font-medium">{t.repairs.partsReplaced}: </dt>
            <dd className="inline break-words text-muted">{parts.join(", ")}</dd>
          </div>
        )}
      </dl>
      {footnote && <p className="mt-2 text-xs text-muted">{footnote}</p>}
    </Link>
  );
}
