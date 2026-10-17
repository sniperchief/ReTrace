import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatIcon, ReceiptIcon } from "@/components/icons";
import { buttonStyles, Card, DetailList, LinkButton, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { repairMessage } from "@/lib/customer-messages";
import { formatNaira } from "@/lib/money";
import { whatsappHref } from "@/lib/phone";
import { getGenerator } from "@/server/data/generators";
import { getRepair } from "@/server/data/repairs";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export default async function RepairPage({ params }: PageProps<"/repairs/[id]">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const repair = await getRepair(technician.id, id);
  if (!repair) notFound();
  if (repair.status === "draft") redirect(`/repairs/${id}/review`);
  const generator = await getGenerator(technician.id, repair.generator.id);
  const t = await getT();
  const phone = generator?.customer.phone ?? null;
  const message = repairMessage(t, {
    customerName: generator?.customer.name ?? "",
    generatorLabel: repair.generator.label,
    date: repair.repairDate ? formatDate(repair.repairDate) : t.repairs.undated,
    reportedSymptoms: repair.reportedSymptoms,
    workPerformed: repair.workPerformed,
    parts: repair.partsReplaced,
    totalKobo: repair.totalCostKobo,
    technicianName: technician.name,
  });
  const none = <span className="text-muted">{t.common.notRecorded}</span>;

  return (
    <>
      <PageHeader
        title={repair.repairDate ? formatDate(repair.repairDate) : t.repairs.undated}
        back={{ href: `/generators/${repair.generator.id}`, label: repair.generator.label }}
        action={<LinkButton href={`/repairs/${id}/edit`} variant="secondary">{t.common.edit}</LinkButton>}
      />
      <div className="mb-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {phone ? (
            <a href={whatsappHref(phone, message)} target="_blank" rel="noopener noreferrer"
              className={`${buttonStyles.secondary} min-h-12`}>
              <ChatIcon size={18} /> {t.share.sendToCustomer}
            </a>
          ) : null}
          <LinkButton href={`/repairs/${id}/receipt`} variant="secondary" className={phone ? "min-h-12" : "min-h-12 sm:col-span-2"}>
            <ReceiptIcon size={18} /> {t.share.receipt}
          </LinkButton>
        </div>
        {!phone && <p className="mt-2 text-xs text-muted">{t.share.noPhone}</p>}
      </div>
      <Card className="space-y-5">
        <DetailList
          items={[
            {
              label: t.repairs.generator,
              value: (
                <Link href={`/generators/${repair.generator.id}`} className="text-foreground underline underline-offset-2">
                  {repair.generator.label}
                </Link>
              ),
            },
            { label: t.repairs.reportedSymptoms, value: repair.reportedSymptoms ?? none },
            { label: t.repairs.diagnosis, value: repair.diagnosis ?? none },
            { label: t.repairs.workPerformed, value: repair.workPerformed ?? none },
          ]}
        />
        <div>
          <h2 className="text-xs font-medium text-muted">{t.repairs.partsReplaced}</h2>
          {repair.partsReplaced.length === 0 ? (
            <p className="mt-0.5 text-muted">{t.repairs.noParts}</p>
          ) : (
            <table className="mt-1 w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1 font-medium">{t.repairs.partName}</th>
                  <th className="py-1 text-right font-medium">{t.repairs.partQuantity}</th>
                  <th className="py-1 text-right font-medium">{t.repairs.partCost}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {repair.partsReplaced.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-2 break-words">{p.name}</td>
                    <td className="py-1.5 text-right">{p.quantity ?? "—"}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {p.costKobo !== null ? formatNaira(p.costKobo) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <DetailList
          items={[
            {
              label: t.repairs.totalCost,
              value: repair.totalCostKobo !== null ? formatNaira(repair.totalCostKobo) : none,
            },
            { label: t.repairs.technicianNotes, value: repair.technicianNotes ?? none },
          ]}
        />
      </Card>
      {repair.originalNotes && (
        <details className="mt-4 rounded-card border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t.review.source} · {repair.sourceKind === "voice" ? t.review.sourceVoice : t.review.sourceText}
          </summary>
          <p className="mt-2 break-words whitespace-pre-line text-sm">{repair.originalNotes}</p>
          {repair.editedNotes && (
            <>
              <h3 className="mt-3 text-xs font-medium text-muted">{t.review.correctedNotes}</h3>
              <p className="break-words whitespace-pre-line text-sm">{repair.editedNotes}</p>
            </>
          )}
        </details>
      )}
    </>
  );
}
