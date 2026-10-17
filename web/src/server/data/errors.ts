export type Entity = "customer" | "generator" | "repair";

/** The record doesn't exist or belongs to another technician. Shown as 404. */
export class NotFoundError extends Error {
  constructor(readonly entity: Entity) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

/** A field value conflicts with another record of the same technician. */
export class ConflictError extends Error {
  constructor(
    readonly field: string,
    readonly code: string,
  ) {
    super(`${field}: ${code}`);
    this.name = "ConflictError";
  }
}
