import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-brand text-brand-foreground hover:opacity-90`,
  secondary: `${buttonBase} border border-border bg-surface text-foreground hover:bg-background`,
  ghost: `${buttonBase} text-muted hover:text-foreground`,
};

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function PageHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <div className="mb-4">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-muted hover:text-foreground">
          ← {back.label}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight break-words">{title}</h1>
        {action}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words whitespace-pre-line">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SearchForm({
  action,
  defaultValue,
  placeholder,
  buttonLabel,
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  buttonLabel: string;
}) {
  return (
    <form action={action} method="get" role="search" className="mb-4 flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={buttonLabel}
        maxLength={100}
        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-base"
      />
      <button type="submit" className={buttonStyles.secondary}>
        {buttonLabel}
      </button>
    </form>
  );
}
