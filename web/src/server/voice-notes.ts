import "server-only";
import { sniffAudio } from "@/lib/audio";
import { getAuth } from "./auth";
import { createVoiceDraft, recordTranscription } from "./data/drafts";
import { NotFoundError } from "./data/errors";
import { findOwnedGenerator } from "./data/generators";
import { claimVoiceUpload } from "./data/voice-uploads";
import { getEnv } from "./env";
import { InferenceError, inferenceMode, transcribeAudio } from "./inference";

export type VoiceNoteResponse =
  | { draftId: string; transcriptStatus: "done" | "failed"; error?: string }
  | { error: string };

const json = (status: number, body: VoiceNoteResponse) => Response.json(body, { status });

/** Reads at most `limit` bytes; returns null if the body is larger. */
async function readLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * POST /api/generators/[id]/voice-notes — raw audio body.
 * Creates a draft for the generator, transcribes the audio, stores the
 * transcript (or the failure) and discards the audio. Never stores audio.
 */
export async function handleVoiceNoteUpload(request: Request, generatorId: string): Promise<Response> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return json(401, { error: "unauthorized" });
  const technicianId = session.user.id;

  if (inferenceMode() === "off") return json(503, { error: "ai_disabled" });

  try {
    await findOwnedGenerator(technicianId, generatorId);
  } catch (error) {
    if (error instanceof NotFoundError) return json(404, { error: "not_found" });
    throw error;
  }

  const { MAX_AUDIO_BYTES, VOICE_NOTES_PER_HOUR } = getEnv();
  let audio = await readLimited(request, MAX_AUDIO_BYTES);
  if (audio === null) return json(413, { error: "audio_too_large" });
  if (!sniffAudio(audio)) return json(415, { error: "audio_unsupported" });

  // Checked after cheap validation so rejected files don't use up the quota.
  const allowance = await claimVoiceUpload(technicianId, { perHour: VOICE_NOTES_PER_HOUR, maxConcurrent: 2 });
  if (allowance !== "ok") {
    return Response.json({ error: allowance } satisfies VoiceNoteResponse, {
      status: 429,
      headers: { "retry-after": allowance === "busy" ? "60" : "900" },
    });
  }

  // The draft exists before transcription, so a failure is recorded, not lost.
  const draftId = await createVoiceDraft(technicianId, generatorId);
  try {
    const result = await transcribeAudio(audio, request.headers.get("content-type") ?? "");
    audio = new Uint8Array(); // drop the reference as soon as it's no longer needed
    const text = result.text.trim();
    if (!text) {
      await recordTranscription(technicianId, draftId, { ok: false, error: "empty_transcript" });
      return json(201, { draftId, transcriptStatus: "failed", error: "empty_transcript" });
    }
    await recordTranscription(technicianId, draftId, {
      ok: true,
      text,
      model: result.model,
      durationSec: result.durationSec,
      processingMs: result.processingMs,
    });
    return json(201, { draftId, transcriptStatus: "done" });
  } catch (error) {
    const code = error instanceof InferenceError ? error.code : "ai_error";
    if (!(error instanceof InferenceError)) console.error("transcription failed", error);
    await recordTranscription(technicianId, draftId, { ok: false, error: code });
    return json(201, { draftId, transcriptStatus: "failed", error: code });
  }
}
