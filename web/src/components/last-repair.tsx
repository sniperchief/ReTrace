import Link from "next/link";
import { interpolate } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { Repair } from "@/server/data/repairs";
import { getT } from "@/server/i18n";
import { HistoryIcon } from "./icons";

/** "Last time (3 Aug 2026): Replaced AVR" — shown as a job starts. */
export async function LastRepairNote({ repair }: { repair: Repair | undefined }) {
  if (!repair) return null;
  const t = await getT();
  const summary = repair.workPerformed ?? repair.diagnosis ?? repair.reportedSymptoms;
  if (!summary) return null;
  return (
    <Link href={`/repairs/${repair.id}`}
      className="mb-6 flex items-start gap-3 rounded-card border border-border bg-tint px-5 py-4 hover:border-line-strong">
      <HistoryIcon size={18} className="mt-0.5 shrink-0 text-muted" />
      <span className="min-w-0 text-sm">
        <span className="font-medium">
          {interpolate(t.voice.lastTime, { date: repair.repairDate ? formatDate(repair.repairDate) : t.repairs.undated })}
        </span>{" "}
        <span className="line-clamp-2 break-words text-muted">{summary}</span>
      </span>
    </Link>
  );
}
