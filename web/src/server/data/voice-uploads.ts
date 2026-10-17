import "server-only";
import { collections, type VoiceUploadDoc } from "./collections";

const HOUR_MS = 60 * 60 * 1000;
/** Matches drafts.ts: a transcription still pending after this is treated as abandoned. */
const PENDING_WINDOW_MS = 6 * 60 * 1000;

export type UploadAllowance = "ok" | "rate_limited" | "busy";

/**
 * Guards the shared, free AI server: at most `perHour` voice notes per
 * technician per hour, and `maxConcurrent` transcriptions running at once.
 * Records the upload when allowed. Discarding drafts doesn't free up the hourly quota.
 */
export async function claimVoiceUpload(
  technicianId: string,
  { perHour, maxConcurrent }: { perHour: number; maxConcurrent: number },
): Promise<UploadAllowance> {
  const now = Date.now();
  const [recent, pending] = await Promise.all([
    collections.voiceUploads().countDocuments({ technicianId, at: { $gte: new Date(now - HOUR_MS) } }),
    collections.repairs().countDocuments({
      technicianId,
      status: "draft",
      "source.kind": "voice",
      "source.transcriptStatus": "pending",
      createdAt: { $gte: new Date(now - PENDING_WINDOW_MS) },
    }),
  ]);
  if (recent >= perHour) return "rate_limited";
  if (pending >= maxConcurrent) return "busy";
  await collections.voiceUploads().insertOne({ technicianId, at: new Date(now) } as VoiceUploadDoc);
  return "ok";
}
