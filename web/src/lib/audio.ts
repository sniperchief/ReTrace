/** Audio container detected from the file's first bytes (the declared type isn't trusted). */
export type AudioKind = "webm" | "ogg" | "mp4" | "wav" | "mp3" | "aac";

export function sniffAudio(bytes: Uint8Array): AudioKind | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(4, 8) === "ftyp") return "mp4"; // mp4, m4a, 3gp
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(0, 3) === "ID3") return "mp3";
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "aac"; // ADTS
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3"; // MPEG frame sync
  return null;
}

export const AUDIO_ACCEPT = "audio/*,.webm,.ogg,.opus,.m4a,.mp4,.3gp,.wav,.mp3,.aac";
