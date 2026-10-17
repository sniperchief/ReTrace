import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftList } from "@/components/draft-list";
import { HistorySummaryCard } from "@/components/history-summary-card";
import { RepairTimeline } from "@/components/repair-timeline";
import { buttonStyles } from "@/components/ui";
import { summariseHistory } from "@/lib/history-summary";
import { listDrafts } from "@/server/data/drafts";
import { getEnv } from "@/server/env";
import { Card, DetailList, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getMessages } from "@/i18n";
import { getGenerator } from "@/server/data/generators";
import { getRepairHistory } from "@/server/data/repairs";
import { requireTechnician } from "@/server/session";

export default async function GeneratorPage({ params }: PageProps<"/generators/[id]">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const [generator, history, drafts] = await Promise.all([
    getGenerator(technician.id, id),
    getRepairHistory(technician.id, id),
    listDrafts(technician.id, { generatorId: id }),
  ]);
  if (!generator || !history) notFound();
  const t = getMessages();
  const summary = summariseHistory(history);
  const aiEnabled = getEnv().INFERENCE_MODE !== "off";
  const none = <span className="text-muted">{t.common.notRecorded}</span>;

  return (
    <>
      <PageHeader
        title={generator.label}
        back={{ href: "/generators", label: t.generators.title }}
        action={<LinkButton href={`/generators/${id}/edit`} variant="secondary">{t.common.edit}</LinkButton>}
      />
      <Card className="mb-6">
        <DetailList
          items={[
            {
              label: t.generators.customer,
              value: (
                <Link href={`/customers/${generator.customer.id}`} className="text-brand underline">
                  {generator.customer.name}
                </Link>
              ),
            },
            { label: t.generators.brand, value: generator.brand ?? none },
            { label: t.generators.model, value: generator.model ?? none },
            { label: t.generators.serialNumber, value: generator.serialNumber ?? none },
            {
              label: t.generators.capacityKva,
              value: generator.capacityKva !== null ? `${generator.capacityKva} kVA` : none,
            },
            {
              label: t.generators.fuelType,
              value: generator.fuelType ? t.generators.fuelTypes[generator.fuelType] : none,
            },
            ...(generator.location ? [{ label: t.generators.location, value: generator.location }] : []),
          ]}
        />
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LinkButton href={`/generators/${id}/voice-note`}>
          {aiEnabled ? `🎙 ${t.voice.button}` : `📝 ${t.voice.quickNotes}`}
        </LinkButton>
        <LinkButton href={`/generators/${id}/repairs/new`} variant="secondary">
          + {t.generators.addRepair}
        </LinkButton>
      </div>
      <DraftList drafts={drafts} />

      {summary && <HistorySummaryCard summary={summary} />}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t.timeline.title}</h2>
          {history.length > 0 && <p className="text-xs text-muted">{t.timeline.hint}</p>}
        </div>
        {history.length > 0 && (
          <form action="/repairs" method="get" role="search" className="flex w-full gap-2 sm:w-auto">
            <input type="hidden" name="generator" value={id} />
            <input name="q" type="search" maxLength={100} aria-label={t.search.searchThisGenerator}
              placeholder={t.search.searchThisGenerator}
              className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-base sm:w-64" />
            <button type="submit" className={buttonStyles.secondary}>{t.search.submit}</button>
          </form>
        )}
      </div>
      {history.length === 0 ? <EmptyState>{t.generators.noHistory}</EmptyState> : <RepairTimeline repairs={history} />}
    </>
  );
}
