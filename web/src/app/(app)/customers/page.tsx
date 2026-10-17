import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { EmptyState, LinkButton, PageHeader, SearchForm } from "@/components/ui";
import { listCustomers } from "@/server/data/customers";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).customers.title };
}

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const technician = await requireTechnician();
  const t = await getT();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : undefined;
  const customers = await listCustomers(technician.id, { query });

  return (
    <>
      <PageHeader
        title={t.customers.title}
        action={<LinkButton href="/customers/new" variant="secondary"><PlusIcon size={16} /> {t.customers.new}</LinkButton>}
      />
      <SearchForm action="/customers" defaultValue={query} placeholder={t.common.searchPlaceholder}
        buttonLabel={t.common.search} />
      {customers.length === 0 ? (
        <EmptyState>{query ? t.common.noResults : t.customers.empty}</EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {customers.map((c) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className="block px-5 py-4 hover:bg-tint">
                <p className="font-medium break-words">{c.name}</p>
                {(c.phone || c.location) && (
                  <p className="text-sm text-muted break-words">
                    {[c.phone, c.location].filter(Boolean).join(" · ")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
