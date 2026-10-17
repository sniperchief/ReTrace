import type { Metadata } from "next";
import { GeneratorForm } from "@/components/generator-form";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getMessages } from "@/i18n";
import { createGeneratorAction } from "@/server/actions/generators";
import { listCustomers } from "@/server/data/customers";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().generators.new };

export default async function NewGeneratorPage({ searchParams }: PageProps<"/generators/new">) {
  const technician = await requireTechnician();
  const t = getMessages();
  const customers = await listCustomers(technician.id, { limit: 1000 });
  const { customerId } = await searchParams;
  const preselected =
    typeof customerId === "string" && customers.some((c) => c.id === customerId) ? customerId : "";
  const backHref = preselected ? `/customers/${preselected}` : "/generators";

  return (
    <>
      <PageHeader title={t.generators.new} back={{ href: backHref, label: t.common.back }} />
      {customers.length === 0 ? (
        <div className="space-y-3">
          <EmptyState>{t.generators.noCustomersYet}</EmptyState>
          <LinkButton href="/customers/new">{t.customers.new}</LinkButton>
        </div>
      ) : (
        <GeneratorForm
          action={createGeneratorAction}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            customerId: preselected,
            label: "",
            brand: "",
            model: "",
            serialNumber: "",
            capacityKva: "",
            fuelType: "",
            location: "",
          }}
          cancelHref={backHref}
        />
      )}
    </>
  );
}
