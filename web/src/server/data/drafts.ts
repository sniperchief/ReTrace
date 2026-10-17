import "server-only";
import type { ExtractionFlag } from "@/lib/extraction";
import type { Engine, FieldKey, FieldSource } from "@/lib/extraction-merge";
import type { RepairFieldsInput } from "@/lib/schemas/repair";
import { collections, type AiSuggestion, type RepairDoc } from "./collections";
import { NotFoundError } from "./errors";
import { findOwnedGenerator, refreshLastRepairAt } from "./generators";
import { toObjectId } from "./ids";
import { fieldsToDoc } from "./repairs";

/**
 * AI-assisted drafts. A draft holds the technician's original notes and the
 * model's suggestion; its record fields stay empty until the technician
 * reviews and confirms them (`confirmDraft`). Drafts never appear in repair
 * history.
 */

/** A run that hasn't finished in this time is treated as abandoned. */
const STALE_MS = 6 * 60 * 1000;

export type Draft = {
  id: string;
  generatorId: string;
  source: Exclude<RepairDoc["source"], { kind: "manual" }>;
  /** Text the extraction uses: the technician's correction if any, else the original. */
  notesForExtraction: string | null;
  aiSuggestion: AiSuggestion | null;
  createdAt: Date;
};

export type DraftSummary = { id: string; generatorId: string; generatorLabel: string; preview: string; createdAt: Date };

function toDraft(doc: RepairDoc): Draft {
  if (doc.source.kind === "manual") throw new Error("not an AI-assisted draft");
  let source = doc.source;
  // An upload whose transcription never finished (request killed) is reported as failed.
  if (source.kind === "voice" && source.transcriptStatus === "pending" && Date.now() - doc.createdAt.getTime() > STALE_MS) {
    source = { ...source, transcriptStatus: "failed", transcriptionError: "interrupted" };
  }
  const original = source.kind === "voice" ? (source.transcriptStatus === "done" ? source.transcript : null) : source.typedText;
  let aiSuggestion = doc.aiSuggestion ?? null;
  if (aiSuggestion?.status === "running" && Date.now() - aiSuggestion.startedAt.getTime() > STALE_MS) {
    aiSuggestion = { status: "failed", error: "ai_timeout", promptVersion: aiSuggestion.promptVersion, createdAt: aiSuggestion.startedAt };
  }
  return {
    id: doc._id.toHexString(),
    generatorId: doc.generatorId.toHexString(),
    source,
    notesForExtraction: source.editedText || original || null,
    aiSuggestion,
    createdAt: doc.createdAt,
  };
}

async function insertDraft(technicianId: string, generatorId: string, source: Draft["source"]): Promise<string> {
  const generator = await findOwnedGenerator(technicianId, generatorId);
  const now = new Date();
  const doc: Omit<RepairDoc, "_id"> = {
    technicianId,
    generatorId: generator._id,
    customerId: generator.customerId,
    status: "draft",
    repairDate: null,
    reportedSymptoms: null,
    diagnosis: null,
    workPerformed: null,
    partsReplaced: [],
    totalCost: null,
    technicianNotes: null,
    source,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await collections.repairs().insertOne(doc as RepairDoc);
  return insertedId.toHexString();
}

export function createVoiceDraft(technicianId: string, generatorId: string): Promise<string> {
  return insertDraft(technicianId, generatorId, { kind: "voice", transcriptStatus: "pending", transcript: null });
}

export function createTextDraft(technicianId: string, generatorId: string, text: string): Promise<string> {
  return insertDraft(technicianId, generatorId, { kind: "text", typedText: text });
}

export async function recordTranscription(
  technicianId: string,
  draftId: string,
  result:
    | { ok: true; text: string; model: string; durationSec: number; processingMs: number }
    | { ok: false; error: string },
): Promise<void> {
  const _id = toObjectId(draftId);
  if (!_id) throw new NotFoundError("repair");
  const set = result.ok
    ? {
        "source.transcriptStatus": "done",
        "source.transcript": result.text,
        "source.transcriptionModel": result.model,
        "source.audioDurationSec": result.durationSec,
        "source.transcriptionMs": result.processingMs,
      }
    : { "source.transcriptStatus": "failed", "source.transcriptionError": result.error };
  const { matchedCount } = await collections
    .repairs()
    .updateOne({ _id, technicianId, status: "draft", "source.kind": "voice" }, { $set: { ...set, updatedAt: new Date() } });
  if (!matchedCount) throw new NotFoundError("repair");
}

export async function getDraft(technicianId: string, draftId: string): Promise<Draft | null> {
  const _id = toObjectId(draftId);
  if (!_id) return null;
  const doc = await collections.repairs().findOne({ _id, technicianId, status: "draft" });
  return doc && doc.source.kind !== "manual" ? toDraft(doc) : null;
}

/** Whether a repair id is an unconfirmed draft of this technician (pages redirect to review). */
export async function isDraft(technicianId: string, repairId: string): Promise<boolean> {
  const _id = toObjectId(repairId);
  if (!_id) return false;
  return (await collections.repairs().countDocuments({ _id, technicianId, status: "draft" }, { limit: 1 })) > 0;
}

/**
 * Marks extraction as running and returns the notes to extract from, or null
 * if there is nothing to do (no notes, already done, or already running).
 * Atomic, so double clicks or retries can't start two runs.
 */
export async function claimExtraction(
  technicianId: string,
  draftId: string,
  promptVersion: string,
  opts: { retry?: boolean } = {},
): Promise<string | null> {
  const draft = await getDraft(technicianId, draftId);
  if (!draft) throw new NotFoundError("repair");
  if (!draft.notesForExtraction) return null;

  const claimable: Record<string, unknown>[] = [
    { aiSuggestion: { $exists: false } },
    { "aiSuggestion.status": "running", "aiSuggestion.startedAt": { $lt: new Date(Date.now() - STALE_MS) } },
  ];
  // A retry re-runs a failed extraction, or one where the AI failed and only the rules filled the form.
  if (opts.retry) claimable.push({ "aiSuggestion.status": "failed" }, { "aiSuggestion.aiError": { $exists: true } });

  const { modifiedCount } = await collections.repairs().updateOne(
    { _id: toObjectId(draftId)!, technicianId, status: "draft", $or: claimable },
    { $set: { aiSuggestion: { status: "running", promptVersion, startedAt: new Date() }, updatedAt: new Date() } },
  );
  return modifiedCount ? draft.notesForExtraction : null;
}

export async function recordExtraction(
  technicianId: string,
  draftId: string,
  result:
    | {
        ok: true;
        fields: RepairFieldsInput;
        flags: ExtractionFlag[];
        sources: Partial<Record<FieldKey, FieldSource>>;
        engine: Engine;
        aiError?: string;
        model: string;
        processingMs: number;
        promptVersion: string;
      }
    | { ok: false; error: string; promptVersion: string },
): Promise<void> {
  const _id = toObjectId(draftId);
  if (!_id) throw new NotFoundError("repair");
  const now = new Date();
  const aiSuggestion: AiSuggestion = result.ok
    ? {
        status: "done",
        fields: result.fields,
        flags: result.flags,
        sources: result.sources,
        engine: result.engine,
        ...(result.aiError ? { aiError: result.aiError } : {}),
        model: result.model,
        promptVersion: result.promptVersion,
        processingMs: result.processingMs,
        createdAt: now,
      }
    : { status: "failed", error: result.error, promptVersion: result.promptVersion, createdAt: now };
  await collections
    .repairs()
    .updateOne({ _id, technicianId, status: "draft" }, { $set: { aiSuggestion, updatedAt: now } });
}

/** Saves the technician's corrected notes (original kept) and clears the old suggestion so extraction re-runs. */
export async function setEditedNotes(technicianId: string, draftId: string, text: string): Promise<void> {
  const _id = toObjectId(draftId);
  if (!_id) throw new NotFoundError("repair");
  const { matchedCount } = await collections.repairs().updateOne(
    { _id, technicianId, status: "draft", "source.kind": { $in: ["voice", "text"] }, "aiSuggestion.status": { $ne: "running" } },
    { $set: { "source.editedText": text, updatedAt: new Date() }, $unset: { aiSuggestion: "" } },
  );
  if (!matchedCount) throw new NotFoundError("repair");
}

/** The technician's explicit confirmation: the reviewed values become the record. */
export async function confirmDraft(technicianId: string, draftId: string, fields: RepairFieldsInput): Promise<string> {
  const _id = toObjectId(draftId);
  if (!_id) throw new NotFoundError("repair");
  const now = new Date();
  const doc = await collections.repairs().findOneAndUpdate(
    { _id, technicianId, status: "draft" },
    { $set: { ...fieldsToDoc(fields), status: "confirmed", confirmedAt: now, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!doc) throw new NotFoundError("repair");
  await refreshLastRepairAt(technicianId, doc.generatorId);
  return doc.generatorId.toHexString();
}

/** Deletes a draft (only drafts; confirmed repairs can't be removed this way). Returns its generator id. */
export async function discardDraft(technicianId: string, draftId: string): Promise<string> {
  const _id = toObjectId(draftId);
  if (!_id) throw new NotFoundError("repair");
  const doc = await collections.repairs().findOneAndDelete({ _id, technicianId, status: "draft" });
  if (!doc) throw new NotFoundError("repair");
  return doc.generatorId.toHexString();
}

export async function listDrafts(
  technicianId: string,
  opts: { generatorId?: string; limit?: number } = {},
): Promise<DraftSummary[]> {
  const filter: Record<string, unknown> = { technicianId, status: "draft" };
  if (opts.generatorId) {
    const generatorId = toObjectId(opts.generatorId);
    if (!generatorId) return [];
    filter.generatorId = generatorId;
  }
  const docs = await collections.repairs().find(filter).sort({ createdAt: -1 }).limit(opts.limit ?? 20).toArray();
  const ids = [...new Map(docs.map((d) => [d.generatorId.toHexString(), d.generatorId])).values()];
  const generators = await collections
    .generators()
    .find({ technicianId, _id: { $in: ids } }, { projection: { label: 1 } })
    .toArray();
  const labels = new Map(generators.map((g) => [g._id.toHexString(), g.label]));
  return docs.map((d) => {
    const notes = d.source.kind === "manual" ? null : d.source.kind === "voice" ? d.source.transcript : d.source.typedText;
    return {
      id: d._id.toHexString(),
      generatorId: d.generatorId.toHexString(),
      generatorLabel: labels.get(d.generatorId.toHexString()) ?? "",
      preview: (notes ?? "").slice(0, 120),
      createdAt: d.createdAt,
    };
  });
}
