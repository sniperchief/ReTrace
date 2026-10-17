import { notFound } from "next/navigation";
import { GeneratorList } from "@/components/generator-list";
import { Card, DetailList, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getMessages } from "@/i18n";
import { getCustomer } from "@/server/data/customers";
import { listGenerators } from "@/server/data/generators";
import { requireTechnician } from "@/server/session";

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const customer = await getCustomer(technician.id, id);
  if (!customer) notFound();
  const generators = await listGenerators(technician.id, { customerId: customer.id });
  const t = getMessages();
  const none = <span className="text-muted">{t.common.notRecorded}</span>;

  return (
    <>
      <PageHeader
        title={customer.name}
        back={{ href: "/customers", label: t.customers.title }}
        action={<LinkButton href={`/customers/${customer.id}/edit`} variant="secondary">{t.common.edit}</LinkButton>}
      />
      <Card className="mb-6">
        <DetailList
          items={[
            { label: t.customers.phone, value: customer.phone ?? none },
            { label: t.customers.location, value: customer.location ?? none },
            ...(customer.notes ? [{ label: t.customers.notes, value: customer.notes }] : []),
          ]}
        />
      </Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t.customers.generators}</h2>
        <LinkButton href={`/generators/new?customerId=${customer.id}`}>+ {t.customers.addGenerator}</LinkButton>
      </div>
      {generators.length === 0 ? (
        <EmptyState>{t.customers.noGenerators}</EmptyState>
      ) : (
        <GeneratorList generators={generators} showCustomer={false} />
      )}
    </>
  );
}
