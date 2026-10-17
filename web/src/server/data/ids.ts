import { ObjectId } from "mongodb";

/** Parses an id from a URL or form; invalid ids are treated as "not found". */
export function toObjectId(id: string): ObjectId | null {
  return /^[a-f\d]{24}$/i.test(id) ? new ObjectId(id) : null;
}
