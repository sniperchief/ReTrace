import Link from "next/link";
import { getMessages } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { DraftSummary } from "@/server/data/drafts";

/** Unconfirmed AI-assisted drafts. Shown apart from repair history. */
export function DraftList({ drafts, showGenerator = false }: { drafts: DraftSummary[]; showGenerator?: boolean }) {
  if (drafts.length === 0) return null;
  const t = getMessages();
  return (
    <section className="mb-6 rounded-card border border-line-strong bg-tint p-4">
      <h2 className="font-bold">{t.review.drafts}</h2>
      <p className="mb-2 text-xs text-muted">{t.review.draftsHint}</p>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id}>
            <Link href={`/repairs/${d.id}/review`} className="block rounded-lg bg-surface px-3 py-2 hover:outline hover:outline-line-strong">
              <span className="text-sm font-medium">
                {showGenerator ? `${d.generatorLabel} · ` : ""}
                {formatDate(d.createdAt)}
              </span>
              <span className="block truncate text-sm text-muted">{d.preview || t.review.noPreview}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
