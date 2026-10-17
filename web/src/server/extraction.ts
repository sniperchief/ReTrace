import "server-only";
import {
  buildExtractionInstructions,
  EXTRACTION_PROMPT_VERSION,
  extractionJsonSchema,
  processModelOutput,
  wrapNotes,
  type ExtractionFlag,
} from "@/lib/extraction";
import { mergeSuggestions, type Engine } from "@/lib/extraction-merge";
import { todayDateInput } from "@/lib/format";
import { extractWithRules } from "@/lib/rule-extraction";
import type { RepairFieldsInput } from "@/lib/schemas/repair";
import { claimExtraction, recordExtraction } from "./data/drafts";
import { generateJson, InferenceError, inferenceMode } from "./inference";

export type ExtractionOutcome =
  | { status: "done"; engine: Engine; aiError?: string }
  | { status: "failed"; error: string }
  | { status: "skipped" }; // nothing to extract, or another run is in progress

export const RULES_MODEL = "rules";

/**
 * Fills a draft's suggestion from its notes using the AI (Gemma) and the
 * rule-based extractor together. The rules always run, so the technician gets
 * a pre-filled form even when the AI is off, asleep or fails. The suggestion
 * is never applied to the record; the technician confirms it.
 */
export async function runExtraction(
  technicianId: string,
  draftId: string,
  opts: { retry?: boolean } = {},
): Promise<ExtractionOutcome> {
  const notes = await claimExtraction(technicianId, draftId, EXTRACTION_PROMPT_VERSION, opts);
  if (notes === null) return { status: "skipped" };

  const today = todayDateInput();
  const started = Date.now();
  try {
    const rules = processModelOutput(JSON.stringify(extractWithRules(notes, today)), notes, today);
    if (!rules.ok) throw new Error("rule extraction produced invalid output"); // can't happen: it's our own JSON

    let ai: { fields: RepairFieldsInput; flags: ExtractionFlag[] } | null = null;
    let aiError: string | undefined;
    let model = RULES_MODEL;
    if (inferenceMode() === "remote") {
      try {
        const generation = await generateJson(buildExtractionInstructions(today), wrapNotes(notes), extractionJsonSchema);
        const processed = processModelOutput(generation.content, notes, today);
        if (processed.ok) {
          ai = processed;
          model = generation.model;
        } else aiError = processed.error;
      } catch (error) {
        aiError = error instanceof InferenceError ? error.code : "ai_error";
        if (!(error instanceof InferenceError)) console.error("AI extraction failed", error);
      }
    }

    const merged = mergeSuggestions(ai, rules);
    await recordExtraction(technicianId, draftId, {
      ok: true,
      ...merged,
      aiError,
      model: merged.engine === "rules" ? RULES_MODEL : merged.engine === "ai+rules" ? `${model} + ${RULES_MODEL}` : model,
      processingMs: Date.now() - started,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });
    return { status: "done", engine: merged.engine, ...(aiError ? { aiError } : {}) };
  } catch (error) {
    console.error("extraction failed", error);
    await recordExtraction(technicianId, draftId, { ok: false, error: "ai_error", promptVersion: EXTRACTION_PROMPT_VERSION });
    return { status: "failed", error: "ai_error" };
  }
}
