import type { Metadata } from "next";
import { GeneratorList } from "@/components/generator-list";
import { EmptyState, LinkButton, PageHeader, SearchForm } from "@/components/ui";
import { listGenerators } from "@/server/data/generators";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).picker.title };
}

/** "New repair" from the navigation: pick the generator, then go straight to the voice note. */
export default async function StartRepairPage({ searchParams }: PageProps<"/repairs/new">) {
  const technician = await requireTechnician();
  const t = await getT();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : undefined;
  const generators = await listGenerators(technician.id, { query });

  return (
    <>
      <PageHeader title={t.picker.title} intro={t.picker.intro} />
      <SearchForm action="/repairs/new" defaultValue={query} placeholder={t.common.searchPlaceholder}
        buttonLabel={t.common.search} />
      {generators.length === 0 ? (
        <EmptyState>{query ? t.common.noResults : t.picker.empty}</EmptyState>
      ) : (
        <GeneratorList generators={generators} hrefFor={(g) => `/generators/${g.id}/voice-note`} />
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted">
        {t.picker.notListed}
        <LinkButton href="/generators/new" variant="ghost" className="px-2 text-foreground underline underline-offset-2">
          {t.picker.addGenerator}
        </LinkButton>
      </div>
    </>
  );
}
