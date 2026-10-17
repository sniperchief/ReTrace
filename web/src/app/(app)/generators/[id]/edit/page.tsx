import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { GeneratorForm } from "@/components/generator-form";
import { PageHeader } from "@/components/ui";
import { interpolate } from "@/i18n";
import { deleteGeneratorAction, updateGeneratorAction } from "@/server/actions/generators";
import { listCustomers } from "@/server/data/customers";
import { getGenerator } from "@/server/data/generators";
import { countGeneratorRecords } from "@/server/data/repairs";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export default async function EditGeneratorPage({ params }: PageProps<"/generators/[id]/edit">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const generator = await getGenerator(technician.id, id);
  if (!generator) notFound();
  const [customers, records] = await Promise.all([
    listCustomers(technician.id, { limit: 1000 }),
    countGeneratorRecords(technician.id, id),
  ]);
  const t = await getT();

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
          serviceIntervalMonths: generator.serviceIntervalMonths?.toString() ?? "",
        }}
        cancelHref={`/generators/${id}`}
      />
      <ConfirmDelete
        action={deleteGeneratorAction.bind(null, id)}
        label={t.danger.deleteGenerator}
        confirmText={
          records > 0 ? interpolate(t.danger.deleteGeneratorConfirm, { count: records }) : t.danger.deleteGeneratorConfirmEmpty
        }
      />
    </>
  );
}
