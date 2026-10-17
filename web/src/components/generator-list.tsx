import Link from "next/link";
import { getMessages } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { GeneratorWithCustomer } from "@/server/data/generators";

export function GeneratorList({
  generators,
  showCustomer = true,
}: {
  generators: GeneratorWithCustomer[];
  showCustomer?: boolean;
}) {
  const t = getMessages();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {generators.map((g) => {
        const details = [g.brand, g.model, g.capacityKva ? `${g.capacityKva} kVA` : null].filter(Boolean);
        return (
          <li key={g.id}>
            <Link href={`/generators/${g.id}`} className="block px-4 py-3 hover:bg-background">
              <p className="font-medium break-words">{g.label}</p>
              <p className="text-sm text-muted break-words">
                {[showCustomer ? g.customer.name : null, details.join(" ") || null].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t.generators.lastRepair}:{" "}
                {g.lastRepairAt ? formatDate(g.lastRepairAt) : t.generators.neverRepaired}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
