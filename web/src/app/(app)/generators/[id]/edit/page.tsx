import { notFound } from "next/navigation";
import { GeneratorForm } from "@/components/generator-form";
import { PageHeader } from "@/components/ui";
import { getMessages } from "@/i18n";
import { updateGeneratorAction } from "@/server/actions/generators";
import { listCustomers } from "@/server/data/customers";
import { getGenerator } from "@/server/data/generators";
import { requireTechnician } from "@/server/session";

export default async function EditGeneratorPage({ params }: PageProps<"/generators/[id]/edit">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const generator = await getGenerator(technician.id, id);
  if (!generator) notFound();
  const customers = await listCustomers(technician.id, { limit: 1000 });
  const t = getMessages();

  return (
    <>
      <PageHeader title={t.generators.editTitle} back={{ href: `/generators/${id}`, label: generator.label }} />
      <GeneratorForm
        action={updateGeneratorAction.bind(null, id)}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          customerId: generator.customerId,
          label: generator.label,
          brand: generator.brand ?? "",
          model: generator.model ?? "",
          serialNumber: generator.serialNumber ?? "",
          capacityKva: generator.capacityKva?.toString() ?? "",
          fuelType: generator.fuelType ?? "",
          location: generator.location ?? "",
        }}
        cancelHref={`/generators/${id}`}
      />
    </>
  );
}
