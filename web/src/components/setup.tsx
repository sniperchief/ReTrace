import Link from "next/link";
import { getMessages, interpolate } from "@/i18n";
import type { SetupStep } from "@/server/data/setup";
import { CheckIcon } from "./icons";
import { buttonStyles } from "./ui";

/** "Step 2 of 3" with the three named steps; finished steps are ticked. */
export function StepIndicator({ step }: { step: SetupStep }) {
  const t = getMessages();
  return (
    <div className="mb-8">
      <p className="mb-3 text-sm font-medium text-muted">{interpolate(t.setup.stepOf, { n: step })}</p>
      <ol className="grid grid-cols-3 gap-2">
        {t.setup.steps.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined}>
              <span className={`block h-1 rounded-full ${state === "todo" ? "bg-border" : "bg-foreground"}`} />
              <span className={`mt-2 flex items-center gap-1 text-xs ${state === "todo" ? "text-muted" : "font-medium"}`}>
                {state === "done" && <CheckIcon size={14} className="shrink-0" />}
                <span className="truncate">{label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Home-screen reminder for a technician who skipped part of the setup. */
export function SetupCard({ step }: { step: SetupStep }) {
  const t = getMessages();
  return (
    <section aria-labelledby="setup-title" className="mb-8 rounded-card bg-stage p-5 text-on-stage">
      <p className="text-xs font-medium text-on-stage-muted">{interpolate(t.setup.stepOf, { n: step })}</p>
      <h2 id="setup-title" className="mt-1 text-xl font-bold">{t.setup.cardTitle}</h2>
      <p className="mt-1 text-sm text-on-stage-muted">
        {interpolate(t.setup.cardNext, { step: t.setup.steps[step - 1] })}
      </p>
      <ol className="mt-4 grid grid-cols-3 gap-2" aria-hidden>
        {[1, 2, 3].map((n) => (
          <li key={n} className={`h-1 rounded-full ${n < step ? "bg-on-stage" : "bg-stage-line"}`} />
        ))}
      </ol>
      <Link href="/welcome" className={`${buttonStyles.onStage} mt-5`}>{t.setup.cardButton}</Link>
    </section>
  );
}
