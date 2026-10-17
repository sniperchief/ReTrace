import { handleVoiceNoteUpload } from "@/server/voice-notes";

// Transcription on the free CPU host can take a while; Vercel Hobby allows up to 300 s.
export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext<"/api/generators/[id]/voice-notes">) {
  const { id } = await ctx.params;
  return handleVoiceNoteUpload(request, id);
}
