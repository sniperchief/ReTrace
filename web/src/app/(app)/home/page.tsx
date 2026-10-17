import type { Metadata } from "next";
import Link from "next/link";
import { DraftList } from "@/components/draft-list";
import { ChevronRightIcon, MicIcon } from "@/components/icons";
import { SetupCard } from "@/components/setup";
import { EmptyState, LinkButton, SearchForm, SectionHeader } from "@/components/ui";
import { getMessages, interpolate } from "@/i18n";
import { formatDate } from "@/lib/format";
import { listDrafts } from "@/server/data/drafts";
import { listRecentRepairs, type RepairWithGenerator } from "@/server/data/repairs";
import { getSetupProgress } from "@/server/data/setup";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().home.title };

/** Action-first home: find a generator, start a repair, finish drafts, see recent work. */
export default async function HomePage() {
  const technician = await requireTechnician();
  const t = getMessages();
  const [progress, drafts, repairs] = await Promise.all([
    getSetupProgress(technician.id),
    listDrafts(technician.id, { limit: 5 }),
    listRecentRepairs(technician.id, { limit: 20 }),
  ]);
  // Most recently recorded work, one row per generator (undated repairs count too).
  const recent = [...new Map(repairs.map((r) => [r.generator.id, r] as const)).values()].slice(0, 5);

  return (
    <>
      <h1 className="mb-6 text-2xl leading-tight font-bold break-words sm:text-3xl">
        {interpolate(t.home.greeting, { name: technician.name })}
      </h1>

      {!progress.done && <SetupCard step={progress.step} />}

      <section aria-labelledby="find-title" className="mb-8">
        <h2 id="find-title" className="mb-3 text-lg font-bold">{t.home.findTitle}</h2>
        <SearchForm action="/generators" placeholder={t.home.findPlaceholder} buttonLabel={t.common.search}
          className="" />
      </section>

      <section className="mb-8">
        <LinkButton href="/repairs/new" className="min-h-14 w-full text-base">
          <MicIcon size={20} /> {t.home.startRepair}
        </LinkButton>
        <p className="mt-2 text-center text-xs text-muted">{t.home.startRepairHint}</p>
      </section>

      <DraftList drafts={drafts} showGenerator />

      <section>
        <SectionHeader
          title={t.home.recentTitle}
          action={
            <Link href="/generators" className="text-sm font-medium underline underline-offset-2">
              {t.home.allGenerators}
            </Link>
          }
        />
        {recent.length === 0 ? <EmptyState>{t.home.recentEmpty}</EmptyState> : <RecentList repairs={recent} />}
      </section>
    </>
  );
}

function RecentList({ repairs }: { repairs: RepairWithGenerator[] }) {
  const t = getMessages();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {repairs.map((r) => (
        <li key={r.generator.id}>
          <Link href={`/generators/${r.generator.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-tint">
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{r.generator.label}</p>
              <p className="truncate text-sm text-muted">
                {[r.repairDate ? formatDate(r.repairDate) : t.repairs.undated, r.workPerformed ?? r.diagnosis]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <ChevronRightIcon size={18} className="shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
