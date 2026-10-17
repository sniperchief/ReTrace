"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentType, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { GeneratorIcon, HistoryIcon, HomeIcon, PeopleIcon, PlusIcon } from "./icons";

type Item = { href: string; label: string; icon: ComponentType<{ size?: number }> };

const NEW_REPAIR = "/repairs/new";

function useItems(): Item[] {
  const t = useMessages();
  return [
    { href: "/home", label: t.nav.home, icon: HomeIcon },
    { href: "/generators", label: t.nav.generators, icon: GeneratorIcon },
    { href: "/customers", label: t.nav.customers, icon: PeopleIcon },
    { href: "/repairs", label: t.nav.repairs, icon: HistoryIcon },
  ];
}

function isActive(pathname: string | null, href: string) {
  if (!pathname || pathname === NEW_REPAIR) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// The active item needs the URL, so each nav streams in after the static shell.
function WithPathname({ render }: { render: (pathname: string | null) => ReactNode }) {
  return <Suspense fallback={render(null)}><PathnameReader render={render} /></Suspense>;
}
function PathnameReader({ render }: { render: (pathname: string | null) => ReactNode }) {
  return render(usePathname());
}

/** Text links in the dark top bar, from tablet width up. */
export function TopNav() {
  const items = useItems();
  const t = useMessages();
  return (
    <WithPathname
      render={(pathname) => (
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                className={`relative flex h-16 items-center px-3 text-sm font-medium ${
                  active ? "text-on-stage" : "text-on-stage-muted hover:text-on-stage"
                }`}>
                {item.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" aria-hidden />}
              </Link>
            );
          })}
          <Link href={NEW_REPAIR}
            className="ml-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-on-stage px-4 text-sm font-medium text-on-stage hover:bg-on-stage/10">
            <PlusIcon size={16} /> {t.nav.newRepair}
          </Link>
        </nav>
      )}
    />
  );
}

/** Thumb-reach navigation on phones, with "New repair" in the middle. */
export function BottomNav() {
  const items = useItems();
  const t = useMessages();
  const [first, second, third, fourth] = items;
  return (
    <WithPathname
      render={(pathname) => {
        const tab = (item: Item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? "text-on-stage" : "text-on-stage-muted"
                }`}>
                {active && <span className="absolute inset-x-4 top-0 h-0.5 bg-accent" aria-hidden />}
                <Icon size={22} />
                {item.label}
              </Link>
            </li>
          );
        };
        return (
          <nav aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-20 border-t border-stage-line bg-stage pb-[env(safe-area-inset-bottom)] md:hidden">
            <ul className="mx-auto flex max-w-md items-stretch">
              {tab(first)}
              {tab(second)}
              <li className="flex flex-1 items-center justify-center">
                <Link href={NEW_REPAIR} aria-label={t.nav.newRepair}
                  aria-current={pathname === NEW_REPAIR ? "page" : undefined}
                  className="flex size-12 items-center justify-center rounded-full bg-on-stage text-stage">
                  <PlusIcon size={24} />
                </Link>
              </li>
              {tab(third)}
              {tab(fourth)}
            </ul>
          </nav>
        );
      }}
    />
  );
}
