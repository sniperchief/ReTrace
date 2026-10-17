import type { Db } from "mongodb";

/** Creates the indexes from docs/technical-spec.md §4. Safe to run repeatedly. */
export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("customers").createIndexes([
    { key: { technicianId: 1, name: 1 }, name: "technician_name" },
    { key: { technicianId: 1, searchKeys: 1 }, name: "technician_searchKeys" },
  ]);
  await db.collection("generators").createIndexes([
    { key: { technicianId: 1, searchKeys: 1 }, name: "technician_searchKeys" },
    { key: { technicianId: 1, customerId: 1 }, name: "technician_customer" },
    { key: { technicianId: 1, lastRepairAt: -1, updatedAt: -1 }, name: "technician_lastRepair" },
    {
      key: { technicianId: 1, serialNumber: 1 },
      name: "technician_serial_unique",
      unique: true,
      partialFilterExpression: { serialNumber: { $type: "string" } },
    },
  ]);
  await db.collection("repairs").createIndexes([
    {
      key: { technicianId: 1, generatorId: 1, repairDate: -1, createdAt: -1 },
      name: "technician_generator_history",
    },
    { key: { technicianId: 1, updatedAt: -1 }, name: "technician_recent" },
    { key: { technicianId: 1, status: 1, updatedAt: -1 }, name: "technician_status" },
    // Repair search: confirmed records of one technician, newest first.
    { key: { technicianId: 1, status: 1, repairDate: -1, createdAt: -1 }, name: "technician_status_date" },
  ]);
}
