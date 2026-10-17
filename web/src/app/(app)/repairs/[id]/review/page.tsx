import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { DiscardDraftButton, ExtractionRunner, NotesForm, RetryButton } from "@/components/draft-components";
import { RepairForm } from "@/components/repair-form";
import { Card, PageHeader } from "@/components/ui";
import { getMessages, type Messages } from "@/i18n";
import { hasAnyField, type ExtractionFlag } from "@/lib/extraction";
import { toRepairFormValues } from "@/lib/repair-form";
import {
  confirmDraftAction,
  correctNotesAction,
  discardDraftAction,
  runExtractionAction,
} from "@/server/actions/drafts";
import { getDraft } from "@/server/data/drafts";
import { getGenerator } from "@/server/data/generators";
import { getRepair } from "@/server/data/repairs";
import { requireTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().review.title };

// Extraction runs as a Server Action on this page and may take a while on the free CPU host.
export const maxDuration = 300;

function failureText(t: Messages, code: string): string {
  return (t.review.failure as Record<string, string>)[code] ?? t.review.failure.ai_error;
}

function flagLabel(t: Messages, field: string): string {
  const names = t.review.fieldNames;
  if (/^partsReplaced\.\d+\.quantity$/.test(field)) return names.partQuantity;
  if (/^partsReplaced\.\d+\.costKobo$/.test(field)) return names.partCost;
  if (/^partsReplaced\.\d+$/.test(field)) return names.part;
  return (names as Record<string, string>)[field] ?? field;
}

function FlagList({ t, flags }: { t: Messages; flags: ExtractionFlag[] }) {
  const groups = [
    { title: t.review.removedTitle, items: flags.filter((f) => f.reason === "not_in_notes") },
    { title: t.review.invalidTitle, items: flags.filter((f) => f.reason === "invalid") },
  ].filter((g) => g.items.length);
  return groups.map((g) => (
    <p key={g.title} className="text-sm">
      {g.title} {[...new Set(g.items.map((f) => flagLabel(t, f.field)))].join(", ")}
    </p>
  ));
}

export default async function ReviewDraftPage({ params }: PageProps<"/repairs/[id]/review">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const draft = await getDraft(technician.id, id);
  if (!draft) {
    if (await getRepair(technician.id, id)) redirect(`/repairs/${id}`); // already confirmed
    notFound();
  }
  const generator = await getGenerator(technician.id, draft.generatorId);
  const t = getMessages();
  const { source, aiSuggestion } = draft;

  const transcriptPending = source.kind === "voice" && source.transcriptStatus === "pending";
  const transcriptFailed = source.kind === "voice" && source.transcriptStatus === "failed";
  const original = source.kind === "voice" ? source.transcript : source.typedText;
  const suggestion = aiSuggestion?.status === "done" ? aiSuggestion : null;
  const run = runExtractionAction.bind(null, id, false);
  const retry = runExtractionAction.bind(null, id, true);

  return (
    <>
      <PageHeader
        title={t.review.title}
        back={generator ? { href: `/generators/${generator.id}`, label: generator.label } : undefined}
      />
      <p className="mb-4 inline-block rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
        {t.review.draftBadge}
      </p>

      {/* The technician's own words, always shown as they were captured. */}
      <Card className="mb-4 space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
          {source.kind === "voice" ? t.review.transcript : t.review.typedNotes}
        </h2>
        {transcriptPending ? (
          <>
            <p className="text-sm text-muted">{t.review.transcribing}</p>
            <AutoRefresh />
          </>
        ) : original ? (
          <p className="break-words whitespace-pre-line">{original}</p>
        ) : (
          <p className="text-sm text-muted">{t.review.noPreview}</p>
        )}
        {source.editedText && (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{t.review.correctedNotes}</h3>
            <p className="break-words whitespace-pre-line">{source.editedText}</p>
          </div>
        )}
      </Card>

      {/* What happened, stated plainly. */}
      <div className="mb-4 space-y-3">
        {transcriptFailed && !source.editedText && (
          <div role="alert" className="space-y-1 rounded-xl bg-danger-bg p-4 text-danger">
            <p className="font-medium">{t.review.transcriptionFailed}</p>
            <p className="text-sm">
              {failureText(t, source.kind === "voice" ? (source.transcriptionError ?? "interrupted") : "ai_error")}
            </p>
            <p className="text-sm">{t.review.manualHint}</p>
          </div>
        )}
        {draft.notesForExtraction && !aiSuggestion && <ExtractionRunner run={run} />}
        {aiSuggestion?.status === "running" && (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm" aria-live="polite">
            {t.review.extracting}
            <AutoRefresh />
          </div>
        )}
        {aiSuggestion?.status === "failed" && (
          <div role="alert" className="space-y-2 rounded-xl bg-danger-bg p-4 text-danger">
            <p className="font-medium">{t.review.extractionFailed}</p>
            <p className="text-sm">{failureText(t, aiSuggestion.error)}</p>
            <p className="text-sm">{t.review.manualHint}</p>
            <RetryButton run={retry} label={t.review.retry} />
          </div>
        )}
        {suggestion && (
          <div className="space-y-1 rounded-xl border border-accent/60 bg-accent/10 p-4" aria-live="polite">
            <p className="font-medium">{hasAnyField(suggestion.fields) ? t.review.extracted : t.review.extractedEmpty}</p>
            <FlagList t={t} flags={suggestion.flags} />
          </div>
        )}
      </div>

      {(!transcriptPending && aiSuggestion?.status !== "running") && (
        <details className="mb-6 rounded-xl border border-border bg-surface p-4" open={transcriptFailed && !source.editedText}>
          <summary className="cursor-pointer font-medium">{t.review.correctNotes}</summary>
          <div className="mt-3">
            <NotesForm
              action={correctNotesAction.bind(null, id)}
              label={t.voice.typedNotes}
              hint={t.review.correctNotesHint}
              submitLabel={t.review.rerun}
              initialNotes={draft.notesForExtraction ?? ""}
            />
          </div>
        </details>
      )}

      <RepairForm
        key={suggestion?.createdAt.toISOString() ?? "empty"}
        action={confirmDraftAction.bind(null, id)}
        initial={toRepairFormValues(suggestion?.fields ?? null)}
        cancelHref={generator ? `/generators/${generator.id}` : "/repairs"}
        submitLabel={t.review.confirmButton}
        confirmLabel={t.review.confirmCheckbox}
      />

      <div className="mt-6 border-t border-border pt-4">
        <DiscardDraftButton action={discardDraftAction.bind(null, id)} label={t.review.discard}
          confirmText={t.review.discardConfirm} />
      </div>
    </>
  );
}
