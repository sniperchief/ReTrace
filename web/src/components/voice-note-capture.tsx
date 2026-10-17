"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { interpolate } from "@/i18n";
import { useMessages } from "@/i18n/client";
import { AUDIO_ACCEPT } from "@/lib/audio";
import { MicIcon, StopIcon } from "./icons";
import { buttonStyles } from "./ui";

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "recorded"; blob: Blob; url: string }
  | { kind: "sending" }
  | { kind: "error"; message: string };

const noopSubscribe = () => () => {};
const MIME_CANDIDATES =["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

/** Records (or picks) a voice note and uploads it for transcription. Audio stays in memory only. */
export function VoiceNoteCapture({
  generatorId,
  maxSeconds,
  maxBytes,
}: {
  generatorId: string;
  maxSeconds: number;
  maxBytes: number;
}) {
  const t = useMessages();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  // null during server rendering; known once in the browser.
  const canRecord = useSyncExternalStore(
    noopSubscribe,
    () => "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia,
    () => null,
  );
  const recorder = useRef<MediaRecorder | null>(null);
  const minutes = Math.round(maxSeconds / 60);

  useEffect(() => {
    // Wake a sleeping inference host while the technician is talking.
    fetch("/api/inference/wake", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase.kind !== "recording") return;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - phase.startedAt) / 1000);
      setElapsed(seconds);
      if (seconds >= maxSeconds) recorder.current?.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [phase, maxSeconds]);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((track) => track.stop()), []);

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setPhase({ kind: "error", message: denied ? t.voice.micDenied : t.voice.micUnavailable });
      return;
    }
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      setPhase({ kind: "recorded", blob, url: URL.createObjectURL(blob) });
    };
    recorder.current = rec;
    rec.start(1000);
    setElapsed(0);
    setPhase({ kind: "recording", startedAt: Date.now() });
  }

  async function send(blob: Blob) {
    if (blob.size > maxBytes) {
      setPhase({ kind: "error", message: interpolate(t.voice.tooLarge, { minutes }) });
      return;
    }
    setPhase({ kind: "sending" });
    let response: Response;
    try {
      response = await fetch(`/api/generators/${generatorId}/voice-notes`, {
        method: "POST",
        headers: { "content-type": blob.type || "application/octet-stream" },
        body: blob,
      });
    } catch {
      setPhase({ kind: "error", message: t.voice.uploadFailed });
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { draftId?: string; error?: string };
    if (response.ok && body.draftId) {
      // Success or a recorded transcription failure: the review page explains which.
      router.push(`/repairs/${body.draftId}/review`);
      return;
    }
    const message =
      body.error === "audio_too_large"
        ? interpolate(t.voice.tooLarge, { minutes })
        : body.error === "audio_unsupported"
          ? t.voice.unsupported
          : body.error === "ai_disabled"
            ? t.voice.aiDisabled
            : t.voice.uploadFailed;
    setPhase({ kind: "error", message });
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {phase.kind === "error" && (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{phase.message}</p>
      )}

      {phase.kind === "sending" ? (
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface p-5" aria-live="polite">
          <span className="size-3 animate-ping rounded-full bg-foreground" />
          <p className="text-sm">{t.voice.transcribing}</p>
        </div>
      ) : phase.kind === "recording" ? (
        <div className="space-y-3 rounded-card border border-border bg-surface p-5 text-center" aria-live="polite">
          <p className="flex items-center justify-center gap-2 font-medium">
            <span className="size-3 animate-pulse rounded-full bg-danger" /> {t.voice.recording} {mmss(elapsed)} / {mmss(maxSeconds)}
          </p>
          <button type="button" className={`${buttonStyles.primary} w-full`} onClick={() => recorder.current?.stop()}>
            <StopIcon size={18} /> {t.voice.stop}
          </button>
        </div>
      ) : phase.kind === "recorded" ? (
        <div className="space-y-3 rounded-card border border-border bg-surface p-5">
          <audio controls src={phase.url} className="w-full" />
          <button type="button" className={`${buttonStyles.primary} w-full`} onClick={() => send(phase.blob)}>
            {t.voice.useRecording}
          </button>
          <button type="button" className={`${buttonStyles.secondary} w-full`} onClick={start}>
            {t.voice.recordAgain}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {canRecord !== false && (
            <button type="button" className={`${buttonStyles.primary} min-h-14 w-full text-base`} onClick={start}
              disabled={canRecord === null}>
              <MicIcon size={20} /> {t.voice.start}
            </button>
          )}
          {canRecord === false && <p className="text-sm text-muted">{t.voice.micUnavailable}</p>}
          <p className="text-center text-xs text-muted">{interpolate(t.voice.limitHint, { minutes })}</p>
        </div>
      )}

      {(phase.kind === "idle" || phase.kind === "error") && (
        <label className={`${buttonStyles.secondary} w-full cursor-pointer`}>
          {t.voice.uploadInstead}
          <input
            type="file"
            accept={AUDIO_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) send(file);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
