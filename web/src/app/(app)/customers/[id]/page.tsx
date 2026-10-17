import { notFound } from "next/navigation";
import { ContactButtons } from "@/components/contact";
import { GeneratorList } from "@/components/generator-list";
import { PlusIcon } from "@/components/icons";
import { Card, DetailList, EmptyState, LinkButton, PageHeader, SectionHeader } from "@/components/ui";
import { getCustomer } from "@/server/data/customers";
import { listGenerators } from "@/server/data/generators";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const customer = await getCustomer(technician.id, id);
  if (!customer) notFound();
  const generators = await listGenerators(technician.id, { customerId: customer.id });
  const t = await getT();
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
            {
              label: t.customers.phone,
              value: customer.phone ? (
                <>
                  {customer.phone}
                  <ContactButtons phone={customer.phone} />
                </>
              ) : (
                none
              ),
            },
            { label: t.customers.location, value: customer.location ?? none },
            ...(customer.notes ? [{ label: t.customers.notes, value: customer.notes }] : []),
          ]}
        />
      </Card>
      <SectionHeader
        title={t.customers.generators}
        action={
          <LinkButton href={`/generators/new?customerId=${customer.id}`} variant="secondary">
            <PlusIcon size={16} /> {t.customers.addGenerator}
          </LinkButton>
        }
      />
      {generators.length === 0 ? (
        <EmptyState>{t.customers.noGenerators}</EmptyState>
      ) : (
        <GeneratorList generators={generators} showCustomer={false} />
      )}
    </>
  );
}
