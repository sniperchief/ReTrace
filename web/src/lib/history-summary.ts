/**
 * A previous-repair summary compiled from CONFIRMED repair records only.
 *
 * It is deterministic (no AI) and only restates what was written down:
 * every item points to the record(s) it came from, missing fields are counted
 * as "not recorded" rather than guessed, and nothing is inferred: it never
 * says a past fault is the current fault, that a part failed again, or that
 * similar symptoms share a cause.
 */

export type SummarySource = {
  id: string;
  repairDate: Date | null;
  reportedSymptoms: string | null;
  diagnosis: string | null;
  workPerformed: string | null;
  partsReplaced: { name: string; quantity: number | null }[];
  totalCostKobo: number | null;
  status: "draft" | "confirmed";
};

export type SourceRef = { id: string; date: Date | null };

export type HistorySummary = {
  recordCount: number;
  datedCount: number;
  firstDate: Date | null;
  lastDate: Date | null;
  /** The most recent record (latest dated one, or an undated one if none are dated). */
  latest: {
    ref: SourceRef;
    reportedSymptoms: string | null;
    diagnosis: string | null;
    workPerformed: string | null;
  } | null;
  /** Parts as written in the records, grouped only when the name is the same (ignoring case and spacing). */
  parts: { name: string; totalQuantity: number | null; refs: SourceRef[] }[];
  /** Sum of the totals that were recorded; recordedCount says how many records had one. */
  charges: { totalKobo: number; recordedCount: number };
  notRecorded: { date: number; reportedSymptoms: number; diagnosis: number; workPerformed: number; totalCost: number };
};

const normalise = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const byDateDesc = (a: SourceRef, b: SourceRef) =>
  (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity);

export function summariseHistory(records: SummarySource[]): HistorySummary | null {
  const confirmed = records.filter((r) => r.status === "confirmed");
  if (confirmed.length === 0) return null;

  const dated = confirmed.filter((r) => r.repairDate).sort((a, b) => b.repairDate!.getTime() - a.repairDate!.getTime());
  const latestRecord = dated[0] ?? confirmed[0];

  // Newest first, so a part is shown with its most recent spelling.
  const newestFirst = [...dated, ...confirmed.filter((r) => !r.repairDate)];
  const parts = new Map<string, { name: string; totalQuantity: number | null; refs: SourceRef[] }>();
  for (const r of newestFirst) {
    for (const p of r.partsReplaced) {
      const key = normalise(p.name);
      if (!key) continue;
      const entry = parts.get(key) ?? { name: p.name.trim().replace(/\s+/g, " "), totalQuantity: 0, refs: [] };
      // If any record didn't state a quantity, the total isn't known.
      entry.totalQuantity = entry.totalQuantity === null || p.quantity === null ? null : entry.totalQuantity + p.quantity;
      if (!entry.refs.some((ref) => ref.id === r.id)) entry.refs.push({ id: r.id, date: r.repairDate });
      parts.set(key, entry);
    }
  }

  const withTotal = confirmed.filter((r) => r.totalCostKobo !== null);
  const count = (pred: (r: SummarySource) => boolean) => confirmed.filter(pred).length;

  return {
    recordCount: confirmed.length,
    datedCount: dated.length,
    firstDate: dated.at(-1)?.repairDate ?? null,
    lastDate: dated[0]?.repairDate ?? null,
    latest: {
      ref: { id: latestRecord.id, date: latestRecord.repairDate },
      reportedSymptoms: latestRecord.reportedSymptoms,
      diagnosis: latestRecord.diagnosis,
      workPerformed: latestRecord.workPerformed,
    },
    parts: [...parts.values()]
      .map((p) => ({ ...p, refs: p.refs.sort(byDateDesc) }))
      .sort((a, b) => byDateDesc(a.refs[0], b.refs[0]) || a.name.localeCompare(b.name)),
    charges: { totalKobo: withTotal.reduce((sum, r) => sum + r.totalCostKobo!, 0), recordedCount: withTotal.length },
    notRecorded: {
      date: count((r) => !r.repairDate),
      reportedSymptoms: count((r) => !r.reportedSymptoms),
      diagnosis: count((r) => !r.diagnosis),
      workPerformed: count((r) => !r.workPerformed),
      totalCost: count((r) => r.totalCostKobo === null),
    },
  };
}
