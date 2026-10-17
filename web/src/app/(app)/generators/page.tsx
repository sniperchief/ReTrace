import type { Metadata } from "next";
import { GeneratorList } from "@/components/generator-list";
import { PlusIcon } from "@/components/icons";
import { EmptyState, LinkButton, PageHeader, SearchForm } from "@/components/ui";
import { listGenerators } from "@/server/data/generators";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).generators.title };
}

export default async function GeneratorsPage({ searchParams }: PageProps<"/generators">) {
  const technician = await requireTechnician();
  const t = await getT();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : undefined;
  const generators = await listGenerators(technician.id, { query });

  return (
    <>
      <PageHeader
        title={t.generators.title}
        action={<LinkButton href="/generators/new" variant="secondary"><PlusIcon size={16} /> {t.generators.new}</LinkButton>}
      />
      <SearchForm action="/generators" defaultValue={query} placeholder={t.common.searchPlaceholder}
        buttonLabel={t.common.search} />
      {generators.length === 0 ? (
        <EmptyState>{query ? t.common.noResults : t.generators.empty}</EmptyState>
      ) : (
        <GeneratorList generators={generators} />
      )}
    </>
  );
}
