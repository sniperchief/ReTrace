import "server-only";
import type { RepairFieldsInput } from "@/lib/schemas/repair";
import { collections, type RepairDoc, type RepairPart } from "./collections";
import { NotFoundError } from "./errors";
import { findOwnedGenerator, refreshLastRepairAt } from "./generators";
import { toObjectId } from "./ids";

export type Repair = {
  id: string;
  generatorId: string;
  customerId: string;
  status: RepairDoc["status"];
  repairDate: Date | null;
  reportedSymptoms: string | null;
  diagnosis: string | null;
  workPerformed: string | null;
  partsReplaced: RepairPart[];
  totalCostKobo: number | null;
  technicianNotes: string | null;
  sourceKind: RepairDoc["source"]["kind"];
  /** The technician's original transcript or typed notes, for AI-assisted records. */
  originalNotes: string | null;
  /** Their corrected version of those notes, if they edited them before extraction. */
  editedNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function originalNotes(source: RepairDoc["source"]): string | null {
  if (source.kind === "voice") return source.transcript;
  if (source.kind === "text") return source.typedText;
  return null;
}

export type RepairWithGenerator = Repair & { generator: { id: string; label: string } };

export function toRepair(doc: RepairDoc): Repair {
  return {
    id: doc._id.toHexString(),
    generatorId: doc.generatorId.toHexString(),
    customerId: doc.customerId.toHexString(),
    status: doc.status,
    repairDate: doc.repairDate,
    reportedSymptoms: doc.reportedSymptoms,
    diagnosis: doc.diagnosis,
    workPerformed: doc.workPerformed,
    partsReplaced: doc.partsReplaced,
    totalCostKobo: doc.totalCost?.amountKobo ?? null,
    technicianNotes: doc.technicianNotes,
    sourceKind: doc.source.kind,
    originalNotes: originalNotes(doc.source),
    editedNotes: doc.source.kind === "manual" ? null : (doc.source.editedText ?? null),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function fieldsToDoc(fields: RepairFieldsInput) {
  return {
    repairDate: fields.repairDate,
    reportedSymptoms: fields.reportedSymptoms,
    diagnosis: fields.diagnosis,
    workPerformed: fields.workPerformed,
    partsReplaced: fields.partsReplaced,
    totalCost:
      fields.totalCostKobo === null ? null : { amountKobo: fields.totalCostKobo, currency: "NGN" as const },
    technicianNotes: fields.technicianNotes,
  };
}

/**
 * Creates a manually entered repair. Manual entries are written by the
 * technician, so they are confirmed immediately.
 */
export async function createRepair(
  technicianId: string,
  generatorId: string,
  fields: RepairFieldsInput,
): Promise<Repair> {
  const generator = await findOwnedGenerator(technicianId, generatorId);
  const now = new Date();
  const doc: Omit<RepairDoc, "_id"> = {
    technicianId,
    generatorId: generator._id,
    customerId: generator.customerId,
    status: "confirmed",
    ...fieldsToDoc(fields),
    source: { kind: "manual" },
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await collections.repairs().insertOne(doc as RepairDoc);
  await refreshLastRepairAt(technicianId, generator._id);
  return toRepair({ ...doc, _id: insertedId });
}

export async function updateRepair(
  technicianId: string,
  id: string,
  fields: RepairFieldsInput,
): Promise<Repair> {
  const _id = toObjectId(id);
  if (!_id) throw new NotFoundError("repair");
  const doc = await collections.repairs().findOneAndUpdate(
    // Drafts are confirmed through the review flow, not edited directly.
    { _id, technicianId, status: "confirmed" },
    { $set: { ...fieldsToDoc(fields), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!doc) throw new NotFoundError("repair");
  await refreshLastRepairAt(technicianId, doc.generatorId);
  return toRepair(doc);
}

export async function getRepair(technicianId: string, id: string): Promise<RepairWithGenerator | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await collections.repairs().findOne({ _id, technicianId });
  if (!doc) return null;
  const generator = await collections
    .generators()
    .findOne({ _id: doc.generatorId, technicianId }, { projection: { label: 1 } });
  return { ...toRepair(doc), generator: { id: doc.generatorId.toHexString(), label: generator?.label ?? "" } };
}

/**
 * A generator's repair history, newest first. Undated records sort after
 * dated ones, then by when they were entered. Returns null if the generator
 * isn't the technician's.
 */
export async function getRepairHistory(technicianId: string, generatorId: string): Promise<Repair[] | null> {
  const _id = toObjectId(generatorId);
  if (!_id) return null;
  const owned = await collections.generators().countDocuments({ _id, technicianId }, { limit: 1 });
  if (!owned) return null;
  const docs = await collections
    .repairs()
    .find({ technicianId, generatorId: _id, status: "confirmed" })
    .sort({ repairDate: -1, createdAt: -1 })
    .toArray();
  return docs.map(toRepair);
}

export async function listRecentRepairs(
  technicianId: string,
  opts: { limit?: number } = {},
): Promise<RepairWithGenerator[]> {
  const docs = await collections
    .repairs()
    .find({ technicianId, status: "confirmed" })
    .sort({ updatedAt: -1 })
    .limit(opts.limit ?? 50)
    .toArray();
  const ids = [...new Map(docs.map((d) => [d.generatorId.toHexString(), d.generatorId])).values()];
  const generators = await collections
    .generators()
    .find({ technicianId, _id: { $in: ids } }, { projection: { label: 1 } })
    .toArray();
  const labels = new Map(generators.map((g) => [g._id.toHexString(), g.label]));
  return docs.map((d) => ({
    ...toRepair(d),
    generator: { id: d.generatorId.toHexString(), label: labels.get(d.generatorId.toHexString()) ?? "" },
  }));
}

/** Deletes a confirmed repair record. Returns its generator id. */
export async function deleteRepair(technicianId: string, id: string): Promise<string> {
  const _id = toObjectId(id);
  if (!_id) throw new NotFoundError("repair");
  // Drafts have their own "discard" path.
  const doc = await collections.repairs().findOneAndDelete({ _id, technicianId, status: "confirmed" });
  if (!doc) throw new NotFoundError("repair");
  await refreshLastRepairAt(technicianId, doc.generatorId);
  return doc.generatorId.toHexString();
}

/** Confirmed repairs and drafts on one generator (for the delete warning). */
export async function countGeneratorRecords(technicianId: string, generatorId: string): Promise<number> {
  const _id = toObjectId(generatorId);
  if (!_id) return 0;
  return collections.repairs().countDocuments({ technicianId, generatorId: _id });
}
