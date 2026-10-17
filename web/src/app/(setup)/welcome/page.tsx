import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerForm } from "@/components/customer-form";
import { GeneratorForm } from "@/components/generator-form";
import { FormIcon, MicIcon } from "@/components/icons";
import { StepIndicator } from "@/components/setup";
import { LinkButton } from "@/components/ui";
import { getMessages, interpolate } from "@/i18n";
import { createCustomerAction } from "@/server/actions/customers";
import { createGeneratorAction } from "@/server/actions/generators";
import { listCustomers } from "@/server/data/customers";
import { getSetupProgress } from "@/server/data/setup";
import { getEnv } from "@/server/env";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().setup.title };

/**
 * First-run flow: customer → generator (customer preselected) → first repair.
 * The step comes from the technician's own records, so it resumes by itself.
 */
export default async function WelcomePage() {
  const technician = await requireTechnician();
  const progress = await getSetupProgress(technician.id);
  if (progress.done) redirect("/home");
  const t = getMessages();
  const s = t.setup;

  const heading = (title: string, intro: string) => (
    <div className="mb-8">
      <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-muted">{intro}</p>
    </div>
  );

  if (progress.step === 1) {
    return (
      <>
        <StepIndicator step={1} />
        {heading(s.customerTitle, s.customerIntro)}
        <CustomerForm action={createCustomerAction} initial={{ name: "", phone: "", location: "", notes: "" }}
          setupFlow submitLabel={s.continueLabel} />
      </>
    );
  }

  if (progress.step === 2) {
    const customers = await listCustomers(technician.id, { limit: 1000 });
    return (
      <>
        <StepIndicator step={2} />
        {heading(s.generatorTitle, s.generatorIntro)}
        <GeneratorForm
          action={createGeneratorAction}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            customerId: progress.customerId ?? "",
            label: "",
            brand: "",
            model: "",
            serialNumber: "",
            capacityKva: "",
            fuelType: "",
            location: "",
          }}
          setupFlow
          submitLabel={s.continueLabel}
        />
      </>
    );
  }

  const generator = progress.generator!;
  const aiEnabled = getEnv().INFERENCE_MODE !== "off";
  return (
    <>
      <StepIndicator step={3} />
      {heading(s.repairTitle, interpolate(s.repairIntro, { label: generator.label }))}
      {progress.draftId && (
        <div className="mb-6 rounded-card border border-line-strong bg-tint p-5">
          <p className="font-medium">{s.draftWaiting}</p>
          <LinkButton href={`/repairs/${progress.draftId}/review`} variant="secondary" className="mt-3">
            {s.reviewDraft}
          </LinkButton>
        </div>
      )}
      <div className="space-y-3">
        <div>
          <LinkButton href={`/generators/${generator.id}/voice-note`} className="min-h-14 w-full text-base">
            {aiEnabled ? <MicIcon size={20} /> : <FormIcon size={20} />}
            {aiEnabled ? s.repairVoice : s.repairNotes}
          </LinkButton>
          <p className="mt-2 text-center text-xs text-muted">{aiEnabled ? s.repairVoiceHint : s.repairNotesHint}</p>
        </div>
        <div>
          <LinkButton href={`/generators/${generator.id}/repairs/new`} variant="secondary" className="w-full">
            <FormIcon size={18} /> {s.repairManual}
          </LinkButton>
          <p className="mt-2 text-center text-xs text-muted">{s.repairManualHint}</p>
        </div>
      </div>
    </>
  );
}
