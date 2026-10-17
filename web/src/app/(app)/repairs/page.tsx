import type { Metadata } from "next";
import { DraftList } from "@/components/draft-list";
import { RepairSearchForm } from "@/components/repair-search-form";
import { RepairSummary } from "@/components/repair-summary";
import { EmptyState, PageHeader } from "@/components/ui";
import { getMessages, interpolate } from "@/i18n";
import { toFieldErrors } from "@/lib/schemas/common";
import { firstParam, isActiveSearch, repairSearchSchema } from "@/lib/schemas/search";
import { listDrafts } from "@/server/data/drafts";
import { getGenerator } from "@/server/data/generators";
import { listRecentRepairs } from "@/server/data/repairs";
import { searchRepairs } from "@/server/data/search";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().repairs.title };

export default async function RepairsPage({ searchParams }: PageProps<"/repairs">) {
  const technician = await requireTechnician();
  const t = getMessages();
  const params = await searchParams;
  const raw = {
    q: firstParam(params.q),
    part: firstParam(params.part),
    from: firstParam(params.from),
    to: firstParam(params.to),
    generator: firstParam(params.generator),
  };
  const parsed = repairSearchSchema.safeParse(raw);
  // Only show the generator chip for this technician's own generator.
  const generator = parsed.success && parsed.data.generator ? await getGenerator(technician.id, parsed.data.generator) : null;
  const form = <RepairSearchForm values={raw} errors={parsed.success ? {} : toFieldErrors(parsed.error)} generatorLabel={generator?.label} />;

  if (parsed.success && isActiveSearch(parsed.data)) {
    const { hits, truncated } = await searchRepairs(technician.id, parsed.data);
    return (
      <>
        <PageHeader title={t.search.title} />
        {form}
        <p className="mb-3 text-sm text-muted" aria-live="polite">
          {hits.length === 1 ? t.search.oneResult : interpolate(t.search.results, { count: hits.length })}
        </p>
        {truncated && <p className="mb-3 text-sm text-muted">{interpolate(t.search.truncated, { limit: 300 })}</p>}
        {hits.length === 0 ? (
          <EmptyState>{t.search.noResults}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {hits.map((hit) => (
              <li key={hit.id}>
                <RepairSummary
                  repair={hit}
                  subtitle={hit.generator.label}
                  footnote={
                    hit.matchedIn.length
                      ? `${t.search.matchedIn}: ${hit.matchedIn.map((f) => t.search.fields[f]).join(", ")}`
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const [repairs, drafts] = await Promise.all([listRecentRepairs(technician.id), listDrafts(technician.id)]);
  return (
    <>
      <PageHeader title={t.repairs.recent} />
      {form}
      <DraftList drafts={drafts} showGenerator />
      {repairs.length === 0 ? (
        <EmptyState>{t.repairs.empty}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {repairs.map((repair) => (
            <li key={repair.id}>
              <RepairSummary repair={repair} subtitle={repair.generator.label} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
