import "server-only";
import type { ObjectId } from "mongodb";
import { collections } from "./collections";

export type SetupStep = 1 | 2 | 3;

export type SetupProgress =
  | { done: true }
  | {
      done: false;
      step: SetupStep;
      /** Most recent customer, preselected on the generator step. */
      customerId: string | null;
      /** Most recent generator, used on the first-repair step. */
      generator: { id: string; label: string } | null;
      /** An unconfirmed draft on that generator, if the technician left mid-review. */
      draftId: string | null;
    };

/**
 * Where a technician is in the first-run flow (customer → generator → first
 * confirmed repair). Derived from their own records, so leaving halfway and
 * coming back resumes at the right step with nothing extra stored.
 */
export async function getSetupProgress(technicianId: string): Promise<SetupProgress> {
  const latest = { sort: { createdAt: -1 as const } };
  const [confirmed, customer, generator] = await Promise.all([
    collections.repairs().findOne({ technicianId, status: "confirmed" }, { projection: { _id: 1 } }),
    collections.customers().findOne<{ _id: ObjectId }>({ technicianId }, { ...latest, projection: { _id: 1 } }),
    collections
      .generators()
      .findOne<{ _id: ObjectId; label: string }>({ technicianId }, { ...latest, projection: { _id: 1, label: 1 } }),
  ]);
  if (confirmed) return { done: true };

  const draft = generator
    ? await collections
        .repairs()
        .findOne<{ _id: ObjectId }>(
          { technicianId, generatorId: generator._id, status: "draft" },
          { ...latest, projection: { _id: 1 } },
        )
    : null;

  return {
    done: false,
    step: generator ? 3 : customer ? 2 : 1,
    customerId: customer?._id.toHexString() ?? null,
    generator: generator ? { id: generator._id.toHexString(), label: generator.label } : null,
    draftId: draft?._id.toHexString() ?? null,
  };
}
