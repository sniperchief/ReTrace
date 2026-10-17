"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { interpolate } from "@/i18n";
import { useMessages } from "@/i18n/client";
import { listQueued, QUEUE_EVENT, removeQueued, uploadRecording } from "@/lib/voice-upload";
import { CloudOffIcon } from "./icons";
import { buttonStyles } from "./ui";

const RETRY_MS = 60_000;

/**
 * Sends recordings that were saved on the phone (no signal, server busy) as
 * soon as it can: on load, when the connection returns, and every minute.
 */
export function UploadQueue() {
  const t = useMessages();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const running = useRef(false);

  const reasonText = useCallback(
    (error: string) =>
      error === "audio_unsupported" ? t.voice.unsupported : error === "ai_disabled" ? t.voice.aiDisabled : t.voice.uploadFailed,
    [t],
  );

  const process = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    setBusy(true);
    try {
      for (const item of await listQueued()) {
        const result = await uploadRecording(item.generatorId, item.blob);
        if (result.status === "retry") break;
        await removeQueued(item.id);
        if (result.status === "ok") {
          setNotice({ text: t.queue.uploaded, tone: "ok" });
          router.refresh();
        } else {
          setNotice({ text: interpolate(t.queue.failed, { reason: reasonText(result.error) }), tone: "error" });
        }
      }
    } catch {
      // IndexedDB unavailable (private mode): nothing was queued, nothing to send.
    } finally {
      running.current = false;
      setBusy(false);
      setCount((await listQueued().catch(() => [])).length);
    }
  }, [reasonText, router, t]);

  useEffect(() => {
    const refreshCount = () => listQueued().then((q) => setCount(q.length)).catch(() => {});
    refreshCount();
    const start = setTimeout(process, 1500);
    const onChange = () => refreshCount();
    window.addEventListener("online", process);
    window.addEventListener(QUEUE_EVENT, onChange);
    const timer = setInterval(process, RETRY_MS);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
      window.removeEventListener("online", process);
      window.removeEventListener(QUEUE_EVENT, onChange);
    };
  }, [process]);

  if (count === 0 && !notice) return null;

  return (
    <div className="mb-6 space-y-2 print:hidden" aria-live="polite">
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-line-strong bg-tint px-5 py-3">
          <CloudOffIcon size={18} className="shrink-0 text-muted" />
          <p className="min-w-0 flex-1 text-sm">
            {busy ? t.queue.uploading : count === 1 ? t.queue.waitingOne : interpolate(t.queue.waiting, { n: count })}
          </p>
          <button type="button" className={`${buttonStyles.secondary} min-h-9 px-3`} disabled={busy} onClick={process}>
            {t.queue.retry}
          </button>
        </div>
      )}
      {notice && (
        <div className={`flex items-center gap-3 rounded-card px-5 py-3 text-sm ${
          notice.tone === "error" ? "bg-danger-bg text-danger" : "border border-border"
        }`}>
          <p className="min-w-0 flex-1">{notice.text}</p>
          <button type="button" className="text-sm underline underline-offset-2" onClick={() => setNotice(null)}>
            {t.flash.dismiss}
          </button>
        </div>
      )}
    </div>
  );
}
