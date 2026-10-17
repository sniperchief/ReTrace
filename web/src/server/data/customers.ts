import "server-only";
import type { CustomerInput } from "@/lib/schemas/customer";
import { searchKeysFilter } from "@/lib/search";
import { collections, type CustomerDoc } from "./collections";
import { NotFoundError } from "./errors";
import { refreshGeneratorSearchKeysForCustomer } from "./generators";
import { toObjectId } from "./ids";
import { customerSearchKeys } from "./searchKeys";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toCustomer(doc: CustomerDoc): Customer {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    phone: doc.phone,
    location: doc.location,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function createCustomer(technicianId: string, input: CustomerInput): Promise<Customer> {
  const now = new Date();
  const doc: Omit<CustomerDoc, "_id"> = {
    technicianId,
    ...input,
    searchKeys: customerSearchKeys(input),
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await collections.customers().insertOne(doc as CustomerDoc);
  return toCustomer({ ...doc, _id: insertedId });
}

export async function getCustomer(technicianId: string, id: string): Promise<Customer | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await collections.customers().findOne({ _id, technicianId });
  return doc ? toCustomer(doc) : null;
}

export async function listCustomers(
  technicianId: string,
  opts: { query?: string; limit?: number } = {},
): Promise<Customer[]> {
  const docs = await collections
    .customers()
    .find({ technicianId, ...searchKeysFilter(opts.query) })
    .sort({ name: 1 })
    .limit(opts.limit ?? 100)
    .toArray();
  return docs.map(toCustomer);
}

export async function updateCustomer(
  technicianId: string,
  id: string,
  input: CustomerInput,
): Promise<Customer> {
  const _id = toObjectId(id);
  if (!_id) throw new NotFoundError("customer");
  const doc = await collections.customers().findOneAndUpdate(
    { _id, technicianId },
    { $set: { ...input, searchKeys: customerSearchKeys(input), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!doc) throw new NotFoundError("customer");

  // Generator search keys include the owner's name and phone; keep them in sync.
  await refreshGeneratorSearchKeysForCustomer(technicianId, doc);
  return toCustomer(doc);
}
