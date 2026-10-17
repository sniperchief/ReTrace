import { notFound, redirect } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { RepairForm } from "@/components/repair-form";
import { PageHeader } from "@/components/ui";
import { toDateInput } from "@/lib/format";
import { koboToInput } from "@/lib/money";
import { deleteRepairAction, updateRepairAction } from "@/server/actions/repairs";
import { getRepair } from "@/server/data/repairs";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export default async function EditRepairPage({ params }: PageProps<"/repairs/[id]/edit">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const repair = await getRepair(technician.id, id);
  if (!repair) notFound();
  if (repair.status === "draft") redirect(`/repairs/${id}/review`);
  const t = await getT();

  return (
    <>
      <PageHeader title={t.repairs.editTitle} back={{ href: `/repairs/${id}`, label: t.common.back }} />
      <RepairForm
        action={updateRepairAction.bind(null, id)}
        initial={{
          repairDate: toDateInput(repair.repairDate),
          reportedSymptoms: repair.reportedSymptoms ?? "",
          diagnosis: repair.diagnosis ?? "",
          workPerformed: repair.workPerformed ?? "",
          totalCost: koboToInput(repair.totalCostKobo),
          technicianNotes: repair.technicianNotes ?? "",
          parts: repair.partsReplaced.map((p) => ({
            name: p.name,
            quantity: p.quantity?.toString() ?? "",
            cost: koboToInput(p.costKobo),
          })),
        }}
        cancelHref={`/repairs/${id}`}
      />
      <ConfirmDelete action={deleteRepairAction.bind(null, id)} label={t.danger.deleteRepair}
        confirmText={t.danger.deleteRepairConfirm} />
    </>
  );
}
