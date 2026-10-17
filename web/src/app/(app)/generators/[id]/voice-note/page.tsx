import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotesForm } from "@/components/draft-components";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { VoiceNoteCapture } from "@/components/voice-note-capture";
import { getMessages } from "@/i18n";
import { createTextDraftAction } from "@/server/actions/drafts";
import { getGenerator } from "@/server/data/generators";
import { getEnv } from "@/server/env";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().voice.title };

export default async function VoiceNotePage({ params }: PageProps<"/generators/[id]/voice-note">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const generator = await getGenerator(technician.id, id);
  if (!generator) notFound();
  const t = getMessages();
  const env = getEnv();
  const manualHref = `/generators/${id}/repairs/new`;

  // Without the AI service there's no transcription, but typed notes still fill the form via the rules.
  if (env.INFERENCE_MODE === "off") {
    return (
      <>
        <PageHeader title={t.voice.quickNotesTitle} back={{ href: `/generators/${id}`, label: generator.label }} />
        <p className="mb-4 text-sm">{t.voice.quickNotesIntro}</p>
        <Card>
          <NotesForm
            action={createTextDraftAction.bind(null, id)}
            label={t.voice.typedNotes}
            hint={t.voice.typedNotesHint}
            submitLabel={t.voice.submitNotes}
          />
        </Card>
        <div className="mt-4 text-center">
          <LinkButton href={manualHref} variant="ghost">{t.voice.manualInstead}</LinkButton>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.voice.title} back={{ href: `/generators/${id}`, label: generator.label }} />
      <p className="mb-1 text-sm">{t.voice.intro}</p>
      <p className="mb-4 text-xs text-muted">{t.voice.privacy}</p>
      <VoiceNoteCapture generatorId={id} maxSeconds={env.MAX_AUDIO_SECONDS} maxBytes={env.MAX_AUDIO_BYTES} />

      <details className="mt-6 rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer font-medium">{t.voice.typeInstead}</summary>
        <div className="mt-3">
          <NotesForm
            action={createTextDraftAction.bind(null, id)}
            label={t.voice.typedNotes}
            hint={t.voice.typedNotesHint}
            submitLabel={t.voice.submitNotes}
          />
        </div>
      </details>

      <div className="mt-4 text-center">
        <LinkButton href={manualHref} variant="ghost">{t.voice.manualInstead}</LinkButton>
      </div>
    </>
  );
}
