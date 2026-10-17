"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useMessages } from "@/i18n/client";

/** Main navigation. The active tab needs the URL, so it streams in after the static shell. */
export function AppNav() {
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  const t = useMessages();
  const items = [
    { href: "/generators", label: t.nav.generators },
    { href: "/customers", label: t.nav.customers },
    { href: "/repairs", label: t.nav.repairs },
  ];

  return (
    <nav className="mx-auto flex w-full max-w-3xl px-2" aria-label="Main">
      {items.map((item) => {
        const active = !!pathname && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm font-medium ${
              active ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
