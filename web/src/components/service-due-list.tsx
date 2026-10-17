import Link from "next/link";
import { interpolate, type Messages } from "@/i18n";
import { serviceReminderMessage } from "@/lib/customer-messages";
import { whatsappHref } from "@/lib/phone";
import { daysUntil } from "@/lib/service";
import type { ServiceDue } from "@/server/data/generators";
import { getT } from "@/server/i18n";
import { ChatIcon } from "./icons";
import { buttonStyles } from "./ui";

function dueText(t: Messages["service"], dueAt: Date): string {
  const days = daysUntil(dueAt);
  if (days === 0) return t.dueToday;
  if (days === 1) return t.dueInOne;
  if (days > 1) return interpolate(t.dueIn, { n: days });
  return days === -1 ? t.overdueOne : interpolate(t.overdue, { n: -days });
}

/** Generators due (or overdue) for their regular service, with a ready-made reminder. */
export async function ServiceDueList({ items, technicianName }: { items: ServiceDue[]; technicianName: string }) {
  const t = await getT();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {items.map((g) => {
        const overdue = daysUntil(g.dueAt) < 0;
        return (
          <li key={g.id} className="flex items-center gap-3 px-5 py-4">
            <Link href={`/generators/${g.id}`} className="min-w-0 flex-1 hover:underline">
              <p className="font-medium break-words">{g.label}</p>
              <p className="truncate text-sm text-muted">{g.customer.name}</p>
              <p className={`mt-1 text-xs ${overdue ? "font-medium text-danger" : "text-muted"}`}>{dueText(t.service, g.dueAt)}</p>
            </Link>
            {g.customer.phone && (
              <a
                href={whatsappHref(
                  g.customer.phone,
                  serviceReminderMessage(t, { customerName: g.customer.name, generatorLabel: g.label, technicianName }),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonStyles.secondary} min-h-10 shrink-0 px-3`}
              >
                <ChatIcon size={16} /> {t.service.remind}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
