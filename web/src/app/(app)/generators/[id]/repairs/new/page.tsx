import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepairForm } from "@/components/repair-form";
import { PageHeader } from "@/components/ui";
import { getMessages } from "@/i18n";
import { todayDateInput } from "@/lib/format";
import { createRepairAction } from "@/server/actions/repairs";
import { getGenerator } from "@/server/data/generators";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().repairs.new };

export default async function NewRepairPage({ params }: PageProps<"/generators/[id]/repairs/new">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const generator = await getGenerator(technician.id, id);
  if (!generator) notFound();
  const t = getMessages();

  return (
    <>
      <PageHeader title={t.repairs.new} back={{ href: `/generators/${id}`, label: generator.label }} />
      <RepairForm
        action={createRepairAction.bind(null, id)}
        initial={{
          repairDate: todayDateInput(),
          reportedSymptoms: "",
          diagnosis: "",
          workPerformed: "",
          totalCost: "",
          technicianNotes: "",
          parts: [],
        }}
        cancelHref={`/generators/${id}`}
      />
    </>
  );
}
