import { z } from "zod";
import { requiredText } from "./common";

export const MAX_NOTES_CHARS = 8000;

/** Typed or corrected repair notes sent for extraction. */
export const notesSchema = z.object({ notes: requiredText(MAX_NOTES_CHARS) });
