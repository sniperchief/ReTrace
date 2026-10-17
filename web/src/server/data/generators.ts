import "server-only";
import { MongoServerError, type ObjectId } from "mongodb";
import type { GeneratorInput } from "@/lib/schemas/generator";
import { searchKeysFilter } from "@/lib/search";
import { nextServiceDue } from "@/lib/service";
import { collections, type CustomerDoc, type GeneratorDoc } from "./collections";
import { ConflictError, NotFoundError } from "./errors";
import { toObjectId } from "./ids";
import { generatorSearchKeys } from "./searchKeys";

export type Generator = {
  id: string;
  customerId: string;
  label: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  capacityKva: number | null;
  fuelType: GeneratorDoc["fuelType"];
  location: string | null;
  lastRepairAt: Date | null;
  serviceIntervalMonths: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GeneratorWithCustomer = Generator & {
  customer: { id: string; name: string; phone: string | null };
};

export function toGenerator(doc: GeneratorDoc): Generator {
  return {
    id: doc._id.toHexString(),
    customerId: doc.customerId.toHexString(),
    label: doc.label,
    brand: doc.brand,
    model: doc.model,
    serialNumber: doc.serialNumber,
    capacityKva: doc.capacityKva,
    fuelType: doc.fuelType,
    location: doc.location,
    lastRepairAt: doc.lastRepairAt,
    serviceIntervalMonths: doc.serviceIntervalMonths ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function findOwnedCustomer(technicianId: string, customerId: string): Promise<CustomerDoc> {
  const _id = toObjectId(customerId);
  const customer = _id ? await collections.customers().findOne({ _id, technicianId }) : null;
  if (!customer) throw new NotFoundError("customer");
  return customer;
}

function rethrowDuplicateSerial(error: unknown): never {
  if (error instanceof MongoServerError && error.code === 11000) {
    throw new ConflictError("serialNumber", "duplicateSerial");
  }
  throw error;
}

export async function createGenerator(technicianId: string, input: GeneratorInput): Promise<Generator> {
  // Refuses to attach a generator to another technician's customer.
  const customer = await findOwnedCustomer(technicianId, input.customerId);
  const now = new Date();
  const doc: Omit<GeneratorDoc, "_id"> = {
    technicianId,
    customerId: customer._id,
    label: input.label,
    brand: input.brand,
    model: input.model,
    serialNumber: input.serialNumber,
    capacityKva: input.capacityKva,
    fuelType: input.fuelType,
    location: input.location,
    searchKeys: generatorSearchKeys(input, customer),
    lastRepairAt: null,
    serviceIntervalMonths: input.serviceIntervalMonths ?? null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const { insertedId } = await collections.generators().insertOne(doc as GeneratorDoc);
    return toGenerator({ ...doc, _id: insertedId });
  } catch (error) {
    rethrowDuplicateSerial(error);
  }
}

export async function updateGenerator(
  technicianId: string,
  id: string,
  input: GeneratorInput,
): Promise<Generator> {
  const _id = toObjectId(id);
  if (!_id) throw new NotFoundError("generator");
  const customer = await findOwnedCustomer(technicianId, input.customerId);
  try {
    const doc = await collections.generators().findOneAndUpdate(
      { _id, technicianId },
      {
        $set: {
          customerId: customer._id,
          label: input.label,
          brand: input.brand,
          model: input.model,
          serialNumber: input.serialNumber,
          capacityKva: input.capacityKva,
          fuelType: input.fuelType,
          location: input.location,
          serviceIntervalMonths: input.serviceIntervalMonths ?? null,
          searchKeys: generatorSearchKeys(input, customer),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
    if (!doc) throw new NotFoundError("generator");
    // Repairs denormalise the owner; keep them consistent if the owner changed.
    await collections
      .repairs()
      .updateMany({ technicianId, generatorId: _id }, { $set: { customerId: customer._id } });
    return toGenerator(doc);
  } catch (error) {
    rethrowDuplicateSerial(error);
  }
}

export async function getGenerator(
  technicianId: string,
  id: string,
): Promise<GeneratorWithCustomer | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await collections.generators().findOne({ _id, technicianId });
  if (!doc) return null;
  const customer = await collections
    .customers()
    .findOne({ _id: doc.customerId, technicianId }, { projection: { name: 1, phone: 1 } });
  return {
    ...toGenerator(doc),
    customer: {
      id: doc.customerId.toHexString(),
      name: customer?.name ?? "",
      phone: customer?.phone ?? null,
    },
  };
}

export async function listGenerators(
  technicianId: string,
  opts: { query?: string; customerId?: string; limit?: number } = {},
): Promise<GeneratorWithCustomer[]> {
  const filter: Record<string, unknown> = { technicianId, ...searchKeysFilter(opts.query) };
  if (opts.customerId) {
    const customerId = toObjectId(opts.customerId);
    if (!customerId) return [];
    filter.customerId = customerId;
  }
  const docs = await collections
    .generators()
    .find(filter)
    .sort({ lastRepairAt: -1, updatedAt: -1 })
    .limit(opts.limit ?? 100)
    .toArray();
  return withCustomers(technicianId, docs);
}

async function withCustomers(
  technicianId: string,
  docs: GeneratorDoc[],
): Promise<GeneratorWithCustomer[]> {
  const ids = [...new Map(docs.map((d) => [d.customerId.toHexString(), d.customerId])).values()];
  const customers = await collections
    .customers()
    .find({ technicianId, _id: { $in: ids } }, { projection: { name: 1, phone: 1 } })
    .toArray();
  const byId = new Map(customers.map((c) => [c._id.toHexString(), c]));
  return docs.map((doc) => {
    const c = byId.get(doc.customerId.toHexString());
    return {
      ...toGenerator(doc),
      customer: { id: doc.customerId.toHexString(), name: c?.name ?? "", phone: c?.phone ?? null },
    };
  });
}

/** Internal: owned generator document, or NotFoundError. */
export async function findOwnedGenerator(technicianId: string, generatorId: string): Promise<GeneratorDoc> {
  const _id = toObjectId(generatorId);
  const doc = _id ? await collections.generators().findOne({ _id, technicianId }) : null;
  if (!doc) throw new NotFoundError("generator");
  return doc;
}

export async function refreshGeneratorSearchKeysForCustomer(
  technicianId: string,
  customer: CustomerDoc,
): Promise<void> {
  const generators = await collections
    .generators()
    .find({ technicianId, customerId: customer._id })
    .toArray();
  if (generators.length === 0) return;
  await collections.generators().bulkWrite(
    generators.map((g) => ({
      updateOne: {
        filter: { _id: g._id, technicianId },
        update: { $set: { searchKeys: generatorSearchKeys(g, customer) } },
      },
    })),
  );
}

export async function refreshLastRepairAt(technicianId: string, generatorId: ObjectId): Promise<void> {
  const latest = await collections
    .repairs()
    .find({ technicianId, generatorId, status: "confirmed", repairDate: { $ne: null } })
    .sort({ repairDate: -1 })
    .limit(1)
    .project<{ repairDate: Date }>({ repairDate: 1 })
    .next();
  await collections
    .generators()
    .updateOne({ _id: generatorId, technicianId }, { $set: { lastRepairAt: latest?.repairDate ?? null } });
}

/**
 * Deletes a generator together with its whole history (confirmed repairs and
 * drafts). The UI warns with the record count first. Returns the customer id.
 */
export async function deleteGenerator(technicianId: string, generatorId: string): Promise<string> {
  const generator = await findOwnedGenerator(technicianId, generatorId);
  await collections.repairs().deleteMany({ technicianId, generatorId: generator._id });
  await collections.generators().deleteOne({ _id: generator._id, technicianId });
  return generator.customerId.toHexString();
}

export type ServiceDue = GeneratorWithCustomer & { dueAt: Date };

/**
 * Generators with a service interval whose next service (last dated repair +
 * interval) falls on or before `until`: overdue first, then soonest.
 */
export async function listServiceDue(technicianId: string, until: Date, limit = 10): Promise<ServiceDue[]> {
  const docs = await collections
    .generators()
    .find({ technicianId, serviceIntervalMonths: { $gte: 1 }, lastRepairAt: { $ne: null } })
    .limit(1000)
    .toArray();
  const due = docs
    .map((doc) => ({ doc, dueAt: nextServiceDue(doc.lastRepairAt, doc.serviceIntervalMonths ?? null) }))
    .filter((d): d is { doc: GeneratorDoc; dueAt: Date } => !!d.dueAt && d.dueAt <= until)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, limit);
  const withCustomer = await withCustomers(technicianId, due.map((d) => d.doc));
  return withCustomer.map((g, i) => ({ ...g, dueAt: due[i].dueAt }));
}
