# Inference benchmark

## Update (2026-10-17): Gemma 3 1B + rule-based fallback (current setup)

To cut memory, the model changed from Gemma 4 E2B to **Gemma 3 1B** (`gemma-3-1b-it-Q4_K_M.gguf`, ggml-org, 806 MB, SHA-256 verified; Gemma Terms of Use licence). A **rule-based extractor** now runs alongside it. The AI's answer wins per field, the rules fill gaps, and both go through the same grounding checks.

| | Gemma 4 E2B (before) | Gemma 3 1B (now) |
|---|---|---|
| llama-server working set | 1,849 MB (partly paged) | **811 MB** |
| Cold load | 25 s | **~5 s** |
| Expected service RAM incl. Whisper | ~5–6 GB | **~2–2.5 GB** |

Same 7 recordings (text fields = problem/diagnosis/work found):

| Sample | Gemma 3 1B alone | Rules alone | **Combined (what the app uses)** |
|---|---|---|---|
| short-plug | 3/3 text, **0/1 parts, total missed** | 3/3, 1/1, ₦5,000 | 3/3, 1/1, ₦5,000 ✅ |
| sparse-noise (clean/noisy) | 3/3, 0/0, none | 3/3, 0/0, none | 3/3, 0/0, none ✅ |
| medium-avr | 3/3, 2/2, ₦30,000 | 3/3, 2/2, ₦30,000 | 3/3, 2/2, ₦30,000 ✅ |
| medium-avr (noisy) | 3/3, **1/2 parts**, ₦30,000 | 3/3, 2/2, ₦30,000 | 3/3, 2/2, ₦30,000 ✅ |
| long-carb (clean/noisy) | 3/3, 3/3, ₦20,000 (date dropped, quantities invalid) | 3/3, 3/3, ₦20,000, date ✅ | 3/3, 3/3, ₦20,000, date ✅ |

- Gemma 3 1B is noticeably weaker than Gemma 4 E2B. It missed the only part and the total on one note and a part on another, and gave invalid quantities. The rules caught every one of these on this set. The combined output matched the expected fields on all 7.
- **Speed figures from this run aren't reliable.** The laptop had only ~0.6 GB of RAM free (database, dev server, editor and browser all open) and was paging to disk. Gemma generated only 4–5 tokens/s, and even Whisper was slower than in the first run (1.2–1.7× real time vs 0.7–1.0×). Extraction took 42–142 s per note. Re-measure on the deploy host.
- **Real end to end** (`tests/integration/real-inference.test.ts`, short note): transcribe 22 s, extract 52 s, engine `ai+rules`, saved after confirmation.
- The rules are tested on these transcripts plus Pidgin phrasing and edge cases (`tests/unit/rule-extraction.test.ts`). They only understand common phrasings, which is why the AI still runs first.

---

# Original Phase 2 benchmark (Gemma 4 E2B)

Measured 2026-10-16 by running the real models **on the development laptop**, not on Hugging Face.

## Setup

| | |
|---|---|
| Machine | Intel Core i5-6200U (2 cores / 4 threads, 2015), 7.9 GB RAM, Windows 10, no GPU. The editor and other apps were open; free RAM before loading Gemma was ~1.2 GB. |
| Whisper | `small`, faster-whisper 1.2.1 (CTranslate2 4.8.3), int8, beam size 1, VAD on, language forced to English |
| Gemma | `gemma-4-E2B_q4_0-it.gguf` (Google QAT Q4_0, 3.35 GB, SHA-256 verified), llama.cpp b11696 CPU, `--threads 2 --ctx-size 4096`, thinking disabled |
| Path | `web/scripts/benchmark-inference.ts`: raw WebM → `/v1/transcribe` → the app's real prompt/schema → `/v1/extract` → the app's `processModelOutput` |

**Recordings:** 4 notes written to sound like technician notes, read aloud by Windows text-to-speech (US voices "David" and "Zira"). 3 copies have generator-like noise added at 10 dB SNR. All are encoded as WebM/Opus at 32 kbps, like browser recordings.

> ⚠️ **These recordings are not representative of real use.** They are clean synthetic US-accented speech, not Nigerian English, Pidgin or code-switching, and the noise is simulated. Accuracy on real recordings will be lower, especially for names and local words. Collect real recordings before trusting these numbers.

## Results

| Sample | Audio | Transcribe | WER* | Extract | Output tokens | Extraction vs expected |
|---|---|---|---|---|---|---|
| short-plug | 15.7 s | 16.3 s | 3.0% | 47.7 s | 129 | all fields correct; **invented date removed** |
| sparse-noise | 13.8 s | 11.6 s | 6.1% | 29.9 s | 97 | all fields correct; **invented date and ₦0 cost removed** |
| sparse-noise (noisy) | 13.8 s | 11.8 s | 6.1% | 31.9 s | 97 | same as clean |
| medium-avr | 33.3 s | 23.9 s | 20.9% | 67.8 s | 208 | all fields, 2/2 parts, total ₦30,000; "today" date kept |
| medium-avr (noisy) | 33.3 s | 25.0 s | 19.8% | 66.9 s | 208 | same as clean |
| long-carb | 54.4 s | 42.3 s | 7.6% | 135.9 s | 272 | all fields, 3/3 parts, total ₦20,000; "3 October" date kept |
| long-carb (noisy) | 54.4 s | 54.9 s† | 2.1% | 112.8 s | 272 | same as clean |

\* Most "errors" are formatting: "3.5 kVA" vs "three point five K V A", "10" vs "ten", "AVR" vs "A V R". The real misrecognitions were Nigerian names and words: "Elepaq" → "Ellipaq", "Baba Tunde in Ikeja" → "Baba Tundin Aikja", "Iya Sade" → "Ayasada", "naira" → "Nira" (amounts still correct).
† The first request also includes loading the Whisper model.

**Speed:** transcription runs at about **0.7–1.0× real time** (a 1-minute note takes ~45–55 s). Gemma processes the prompt at **~10–13 tokens/s** and generates at **~3.5–4 tokens/s**.

**End to end** (one real recording through the web code path, `tests/integration/real-inference.test.ts`): upload → transcript → suggestion → confirmed repair took **119 s** for a 33 s noisy note, including a cold Whisper load.

**Thinking mode:** Gemma 4 "thinks" by default. That produced ~260 hidden reasoning tokens before a 25-token answer, and one request took **161 s instead of 14 s**. The service now disables it (`LLM_ENABLE_THINKING=false`).

## Memory and startup

| | |
|---|---|
| llama-server (Gemma) peak working set | 1,849 MB (on this RAM-starved laptop Windows kept part of the memory-mapped 3.35 GB model paged out; expect ~3.5–4 GB resident on a 16 GB host) |
| Whisper API process peak working set | 542–566 MB |
| Gemma load time (cold, to `/health` OK) | 25 s |
| Whisper load time (cold) | 7.1 s |

Both together fit comfortably in a free HF Space's 16 GB. On this 7.9 GB laptop they fit only with paging.

## What this means

- **Accuracy (synthetic audio):** extraction was correct on every sample. The grounding checks did their job: Gemma invented a date on 2 notes and a ₦0 cost on 1 note, and the app removed and flagged all of them.
- **Latency:** with the laptop's 2 cores, a 30–60 s note takes about **1.5–3 minutes** from upload to filled form. A full 3-minute note would likely take longer than the timeouts allow (Whisper ~2.5 min plus Gemma ~3–4 min). On this hardware, keep notes **under about 1 minute**.
- **The free Hugging Face Space has not been measured.** It has 2 vCPUs, 16 GB RAM and a CPU model that isn't published. It may be faster or slower than this laptop. Run `scripts/benchmark-inference.ts` against the Space before relying on it.

## Re-running

```powershell
# inference service running on :7860 (see inference/README.md), then:
cd inference; powershell -File benchmark\make_samples.ps1; .venv\Scripts\python benchmark\encode_samples.py
cd ..\web
$env:INFERENCE_BASE_URL="http://127.0.0.1:7860"; $env:INFERENCE_API_KEY="<key>"
npx tsx scripts/benchmark-inference.ts ..\inference\.models\samples ..\inference\benchmark\samples.json

# real end-to-end through the web code (skipped unless these are set)
$env:REAL_INFERENCE_URL="http://127.0.0.1:7860"; $env:REAL_INFERENCE_KEY="<key>"; $env:REAL_INFERENCE_SAMPLE="<file.webm>"
npx vitest run tests/integration/real-inference.test.ts
```
