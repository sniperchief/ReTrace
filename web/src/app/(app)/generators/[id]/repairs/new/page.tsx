import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepairForm } from "@/components/repair-form";
import { LastRepairNote } from "@/components/last-repair";
import { PageHeader } from "@/components/ui";
import { todayDateInput } from "@/lib/format";
import { createRepairAction } from "@/server/actions/repairs";
import { getGenerator } from "@/server/data/generators";
import { getRepairHistory } from "@/server/data/repairs";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).repairs.new };
}

export default async function NewRepairPage({ params }: PageProps<"/generators/[id]/repairs/new">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const [generator, history] = await Promise.all([getGenerator(technician.id, id), getRepairHistory(technician.id, id)]);
  if (!generator) notFound();
  const t = await getT();

  return (
    <>
      <PageHeader title={t.repairs.new} back={{ href: `/generators/${id}`, label: generator.label }} />
      <LastRepairNote repair={history?.[0]} />
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
