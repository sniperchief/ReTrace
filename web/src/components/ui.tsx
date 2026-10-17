import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeftIcon, SearchIcon } from "./icons";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-60";

export const buttonStyles = {
  /** Teal: the one main action on a screen. */
  primary: `${buttonBase} bg-accent text-accent-foreground hover:bg-[#17b3b0]`,
  secondary: `${buttonBase} border border-line-strong bg-surface text-foreground hover:border-foreground`,
  ghost: `${buttonBase} text-muted hover:text-foreground`,
  /** Outlined light button for dark (stage) surfaces. */
  onStage: `${buttonBase} border border-on-stage text-on-stage hover:bg-on-stage/10 focus-visible:outline-on-stage`,
};

export const inputClass =
  "block w-full min-h-11 min-w-0 rounded-lg border border-line-strong bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted/70 focus:border-foreground focus:outline-none aria-[invalid=true]:border-danger";

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
  intro,
}: {
  title: string;
  back?: { href: string; label: string };
  action?: ReactNode;
  intro?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href}
          className="mb-3 inline-flex min-h-8 max-w-full items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeftIcon size={16} className="shrink-0" />
          <span className="truncate">{back.label}</span>
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl leading-tight font-bold break-words sm:text-3xl">{title}</h1>
        {action}
      </div>
      {intro && <div className="mt-2 text-muted">{intro}</div>}
    </div>
  );
}

export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-border bg-surface p-5 ${className}`}>{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong px-5 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
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
  className = "mb-5",
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  buttonLabel: string;
  className?: string;
}) {
  return (
    <form action={action} method="get" role="search" className={`flex gap-2 ${className}`}>
      <div className="relative min-w-0 flex-1">
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={buttonLabel}
          maxLength={100}
          className={`${inputClass} pl-10`}
        />
      </div>
      <button type="submit" className={buttonStyles.secondary}>
        {buttonLabel}
      </button>
    </form>
  );
}

/** The ReTrace wordmark, for dark (stage) surfaces. */
export function Wordmark({ href, className = "" }: { href: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 text-lg font-bold text-on-stage ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 12a8 8 0 1 0 2.4-5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      ReTrace
    </Link>
  );
}
