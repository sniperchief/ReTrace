import "server-only";
import {
  buildExtractionInstructions,
  EXTRACTION_PROMPT_VERSION,
  extractionJsonSchema,
  processModelOutput,
  wrapNotes,
} from "@/lib/extraction";
import { todayDateInput } from "@/lib/format";
import { claimExtraction, recordExtraction } from "./data/drafts";
import { generateJson, InferenceError } from "./inference";

export type ExtractionOutcome =
  | { status: "done" }
  | { status: "failed"; error: string }
  | { status: "skipped" }; // nothing to extract, or another run is in progress

/**
 * Runs Gemma on a draft's notes and stores the validated suggestion. The
 * suggestion is never applied to the record; the technician confirms it.
 */
export async function runExtraction(
  technicianId: string,
  draftId: string,
  opts: { retry?: boolean } = {},
): Promise<ExtractionOutcome> {
  const notes = await claimExtraction(technicianId, draftId, EXTRACTION_PROMPT_VERSION, opts);
  if (notes === null) return { status: "skipped" };

  const today = todayDateInput();
  try {
    const generation = await generateJson(buildExtractionInstructions(today), wrapNotes(notes), extractionJsonSchema);
    const processed = processModelOutput(generation.content, notes, today);
    if (!processed.ok) {
      await recordExtraction(technicianId, draftId, {
        ok: false,
        error: processed.error,
        promptVersion: EXTRACTION_PROMPT_VERSION,
      });
      return { status: "failed", error: processed.error };
    }
    await recordExtraction(technicianId, draftId, {
      ok: true,
      fields: processed.fields,
      flags: processed.flags,
      model: generation.model,
      processingMs: generation.processingMs,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });
    return { status: "done" };
  } catch (error) {
    const code = error instanceof InferenceError ? error.code : "ai_error";
    await recordExtraction(technicianId, draftId, { ok: false, error: code, promptVersion: EXTRACTION_PROMPT_VERSION });
    if (!(error instanceof InferenceError)) console.error("extraction failed", error);
    return { status: "failed", error: code };
  }
}
