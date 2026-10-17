import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { GeneratorWithCustomer } from "@/server/data/generators";
import { getT } from "@/server/i18n";
import { ChevronRightIcon } from "./icons";

export async function GeneratorList({
  generators,
  showCustomer = true,
  hrefFor = (g) => `/generators/${g.id}`,
}: {
  generators: GeneratorWithCustomer[];
  showCustomer?: boolean;
  /** Where each row leads; the repair picker sends rows to the voice note page. */
  hrefFor?: (generator: GeneratorWithCustomer) => string;
}) {
  const t = await getT();
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {generators.map((g) => {
        const details = [g.brand, g.model, g.capacityKva ? `${g.capacityKva} kVA` : null].filter(Boolean);
        return (
          <li key={g.id}>
            <Link href={hrefFor(g)} className="flex items-center gap-3 px-5 py-4 hover:bg-tint">
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{g.label}</p>
                <p className="text-sm text-muted break-words">
                  {[showCustomer ? g.customer.name : null, details.join(" ") || null].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t.generators.lastRepair}:{" "}
                  {g.lastRepairAt ? formatDate(g.lastRepairAt) : t.generators.neverRepaired}
                </p>
              </div>
              <ChevronRightIcon size={18} className="shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
