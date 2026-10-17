import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactButtons } from "@/components/contact";
import { DraftList } from "@/components/draft-list";
import { HistorySummaryCard } from "@/components/history-summary-card";
import { FormIcon, MicIcon, PlusIcon } from "@/components/icons";
import { RepairTimeline } from "@/components/repair-timeline";
import {
  buttonStyles,
  Card,
  DetailList,
  EmptyState,
  inputClass,
  LinkButton,
  PageHeader,
  SectionHeader,
} from "@/components/ui";
import { interpolate } from "@/i18n";
import { formatDate } from "@/lib/format";
import { summariseHistory } from "@/lib/history-summary";
import { nextServiceDue } from "@/lib/service";
import { listDrafts } from "@/server/data/drafts";
import { getGenerator } from "@/server/data/generators";
import { getRepairHistory } from "@/server/data/repairs";
import { getEnv } from "@/server/env";
import { getT } from "@/server/i18n";
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
  const t = await getT();
  const summary = summariseHistory(history);
  const aiEnabled = getEnv().INFERENCE_MODE !== "off";
  const none = <span className="text-muted">{t.common.notRecorded}</span>;
  const interval = generator.serviceIntervalMonths;
  const nextDue = nextServiceDue(generator.lastRepairAt, interval);

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
                <>
                  <Link href={`/customers/${generator.customer.id}`} className="text-foreground underline underline-offset-2">
                    {generator.customer.name}
                  </Link>
                  {generator.customer.phone && <ContactButtons phone={generator.customer.phone} />}
                </>
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
            ...(interval
              ? [
                  {
                    label: t.service.next,
                    value: nextDue
                      ? formatDate(nextDue)
                      : interpolate(t.service.nextNoRepair, {
                          months: interval === 1 ? t.service.monthsOne : interpolate(t.service.months, { n: interval }),
                        }),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LinkButton href={`/generators/${id}/voice-note`} className="min-h-12">
          {aiEnabled ? <MicIcon size={18} /> : <FormIcon size={18} />}
          {aiEnabled ? t.voice.button : t.voice.quickNotes}
        </LinkButton>
        <LinkButton href={`/generators/${id}/repairs/new`} variant="secondary" className="min-h-12">
          <PlusIcon size={18} /> {t.generators.addRepair}
        </LinkButton>
      </div>
      <DraftList drafts={drafts} />

      {summary && <HistorySummaryCard summary={summary} />}

      <SectionHeader
        title={t.timeline.title}
        hint={history.length > 0 ? t.timeline.hint : undefined}
        action={
          history.length > 0 && (
            <form action="/repairs" method="get" role="search" className="flex w-full gap-2 sm:w-auto">
              <input type="hidden" name="generator" value={id} />
              <input name="q" type="search" maxLength={100} aria-label={t.search.searchThisGenerator}
                placeholder={t.search.searchThisGenerator} className={`${inputClass} sm:w-64`} />
              <button type="submit" className={buttonStyles.secondary}>{t.search.submit}</button>
            </form>
          )
        }
      />
      {history.length === 0 ? <EmptyState>{t.generators.noHistory}</EmptyState> : <RepairTimeline repairs={history} />}
    </>
  );
}
