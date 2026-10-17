import { interpolate, type Messages } from "@/i18n";
import { formatNaira } from "./money";

/** Text a technician sends to a customer on WhatsApp. Only recorded fields are included. */
export function repairMessage(
  t: Messages,
  r: {
    customerName: string;
    generatorLabel: string;
    date: string;
    reportedSymptoms: string | null;
    workPerformed: string | null;
    parts: { name: string; quantity: number | null; costKobo: number | null }[];
    totalKobo: number | null;
    technicianName: string;
  },
): string {
  const s = t.share;
  const parts = r.parts.map((p) => {
    const qty = p.quantity && p.quantity > 1 ? ` ×${p.quantity}` : "";
    const cost = p.costKobo !== null ? ` (${formatNaira(p.costKobo)})` : "";
    return `- ${p.name}${qty}${cost}`;
  });
  const lines = [
    r.customerName ? interpolate(s.greeting, { name: r.customerName }) : null,
    interpolate(s.intro, { label: r.generatorLabel, date: r.date }),
    "",
    r.reportedSymptoms ? `${s.problem}: ${r.reportedSymptoms}` : null,
    r.workPerformed ? `${s.work}: ${r.workPerformed}` : null,
    parts.length ? `${s.parts}:\n${parts.join("\n")}` : null,
    r.totalKobo !== null ? `${s.total}: ${formatNaira(r.totalKobo)}` : null,
    "",
    interpolate(s.signoff, { technician: r.technicianName }),
  ];
  return lines
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function serviceReminderMessage(
  t: Messages,
  r: { customerName: string; generatorLabel: string; technicianName: string },
): string {
  return interpolate(t.service.reminder, {
    name: r.customerName,
    label: r.generatorLabel,
    technician: r.technicianName,
  });
}
