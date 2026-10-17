import Link from "next/link";
import { buttonStyles, Wordmark } from "@/components/ui";
import { getMessages } from "@/i18n";

// Signed-in technicians are sent to /home by the proxy before reaching here,
// so this page reads no session and renders fully static.
export default function Landing() {
  const t = getMessages();
  const l = t.landing;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <section className="overflow-hidden bg-stage text-on-stage">
        <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 md:h-16">
          <Wordmark href="/" />
          <Link href="/sign-in" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-on-stage-muted hover:text-on-stage">
            {l.signIn}
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-14 text-center md:pt-24">
          <p className="mb-6 rounded-full border border-stage-line px-3 py-1 text-xs font-medium text-on-stage-muted">
            {l.badge}
          </p>
          <h1 className="max-w-3xl text-[2.5rem] leading-[1.1] font-bold sm:text-5xl md:text-7xl">
            {l.headlineStart} <span className="text-accent">{l.headlineEmphasis}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-on-stage-muted sm:text-lg">{l.lede}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/sign-up" className={`${buttonStyles.primary} min-h-12 text-base`}>{l.createAccount}</Link>
            <Link href="/sign-in" className={`${buttonStyles.onStage} min-h-12 text-base`}>{l.signIn}</Link>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-20 md:py-28" aria-labelledby="how-title">
        <h2 id="how-title" className="text-3xl font-bold md:text-5xl">{l.howTitle}</h2>
        <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {l.steps.map((step, i) => (
            <li key={step.title} className="rounded-card border border-border p-6">
              <p className="text-sm font-medium text-muted">0{i + 1}</p>
              <h3 className="mt-6 text-2xl leading-tight font-bold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-border">
        <p className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-muted">{l.footer}</p>
      </footer>
    </div>
  );
}

/**
 * A drawn (not screenshotted) generator record, cropped at the bottom edge of
 * the hero like the design system's product frame. Decorative only.
 */
function ProductPreview() {
  const l = getMessages().landing;
  return (
    <div aria-hidden className="mt-14 w-full max-w-2xl translate-y-6 text-left md:mt-20">
      <div className="rounded-t-card border border-b-0 border-stage-line bg-stage-line/30 p-5 pb-10 sm:p-7 sm:pb-12">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{l.previewGenerator}</p>
            <p className="truncate text-sm text-on-stage-muted">{l.previewCustomer}</p>
          </div>
          <span className="shrink-0 rounded-full border border-stage-line px-3 py-1 text-xs text-on-stage-muted">
            {l.previewCount}
          </span>
        </div>
        <ol className="mt-6 space-y-3 border-l border-stage-line pl-5">
          {l.previewEntries.map((entry) => (
            <li key={entry.date} className="relative">
              <span className="absolute top-2 -left-[24.5px] size-2 rounded-full bg-on-stage" />
              <p className="text-xs text-on-stage-muted">{entry.date}</p>
              <p className="text-sm">{entry.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
