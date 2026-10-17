import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { PageHeader, Wordmark } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import { getGenerator } from "@/server/data/generators";
import { getRepair } from "@/server/data/repairs";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).share.receiptTitle };
}

/** A printable record for the customer. The app chrome is hidden when printing. */
export default async function ReceiptPage({ params }: PageProps<"/repairs/[id]/receipt">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const repair = await getRepair(technician.id, id);
  if (!repair) notFound();
  if (repair.status === "draft") redirect(`/repairs/${id}/review`);
  const generator = await getGenerator(technician.id, repair.generator.id);
  const t = await getT();
  const s = t.share;

  const rows = [
    { label: s.date, value: repair.repairDate ? formatDate(repair.repairDate) : t.repairs.undated },
    { label: s.technician, value: technician.name },
    { label: s.customer, value: [generator?.customer.name, generator?.customer.phone].filter(Boolean).join(" · ") },
    {
      label: s.generator,
      value: [repair.generator.label, generator?.brand, generator?.model, generator?.serialNumber].filter(Boolean).join(" · "),
    },
  ];
  const details = [
    { label: t.repairs.reportedSymptoms, value: repair.reportedSymptoms },
    { label: t.repairs.diagnosis, value: repair.diagnosis },
    { label: t.repairs.workPerformed, value: repair.workPerformed },
  ].filter((d) => d.value);

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={s.receiptTitle} back={{ href: `/repairs/${id}`, label: t.common.back }}
          action={<PrintButton label={s.print} />} />
      </div>

      <article className="rounded-card border border-border p-6 print:rounded-none print:border-0 print:p-0">
        <header className="-mx-6 -mt-6 mb-6 flex items-center justify-between gap-3 rounded-t-card bg-stage px-6 py-4 print:mx-0 print:mt-0 print:rounded-none">
          <Wordmark href="/home" />
          <p className="text-sm text-on-stage-muted">{s.receiptTitle}</p>
        </header>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs font-medium text-muted">{r.label}</dt>
              <dd className="mt-0.5 break-words">{r.value || "—"}</dd>
            </div>
          ))}
        </dl>

        {details.length > 0 && (
          <dl className="mt-6 space-y-3 border-t border-border pt-6">
            {details.map((d) => (
              <div key={d.label}>
                <dt className="text-xs font-medium text-muted">{d.label}</dt>
                <dd className="mt-0.5 break-words whitespace-pre-line">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <table className="mt-6 w-full border-t border-border text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="pt-4 pb-2 font-medium">{t.repairs.partName}</th>
              <th className="pt-4 pb-2 text-right font-medium">{t.repairs.partQuantity}</th>
              <th className="pt-4 pb-2 text-right font-medium">{t.repairs.partCost}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {repair.partsReplaced.length === 0 ? (
              <tr><td colSpan={3} className="py-2 text-muted">{t.repairs.noParts}</td></tr>
            ) : (
              repair.partsReplaced.map((p, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2 break-words">{p.name}</td>
                  <td className="py-2 text-right">{p.quantity ?? "—"}</td>
                  <td className="py-2 text-right whitespace-nowrap">{p.costKobo !== null ? formatNaira(p.costKobo) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <p className="mt-6 flex items-baseline justify-between border-t border-foreground pt-4 text-lg font-bold">
          <span>{s.total}</span>
          <span>{repair.totalCostKobo !== null ? formatNaira(repair.totalCostKobo) : "—"}</span>
        </p>
      </article>
    </>
  );
}
