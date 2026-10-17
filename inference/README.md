---
title: ReTrace Inference
emoji: 🔧
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# ReTrace inference service

Self-hosted **Whisper** (speech-to-text, via faster-whisper) and **Gemma 3 1B** (structured extraction, via the llama.cpp server). CPU only. Needs about 2–2.5 GB of RAM in total (Gemma ~0.8 GB, Whisper ~0.5 GB, plus the service itself).

The YAML block above is Hugging Face Space metadata.

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /healthz` | none | Wake-up ping; reports whether models are ready. Reveals no data. |
| `POST /v1/transcribe` | Bearer key | Raw audio body (WebM/Ogg/MP4/WAV/MP3) → `{ text, durationSec, model, processingMs }` |
| `POST /v1/extract` | Bearer key | `{ instructions, text, schema }` → `{ content, model, processingMs }` (raw JSON text, validated by the web app) |

The service is stateless. Audio is decoded in memory, never written to disk, and discarded after the request. It doesn't log transcripts.

## Run locally (Windows, no Docker)

```powershell
cd inference
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt pytest psutil
copy .env.example .env   # set INFERENCE_API_KEY

# 1. llama.cpp CPU server (https://github.com/ggml-org/llama.cpp/releases, "bin-win-cpu-x64")
#    and the Gemma 3 1B GGUF (ggml-org/gemma-3-1b-it-GGUF, gemma-3-1b-it-Q4_K_M.gguf, ~0.8 GB)
.\.bin\llama\llama-server.exe -m .models\gemma-3-1b-it-Q4_K_M.gguf --host 127.0.0.1 --port 8080 -c 4096 -t 2 --parallel 1 --jinja

# 2. The API (downloads Whisper "small", ~480 MB, on first use)
.\.venv\Scripts\python -m uvicorn app.main:app --port 7860
```

Point the web app at it with `INFERENCE_MODE=remote`, `INFERENCE_BASE_URL=http://127.0.0.1:7860` and the same `INFERENCE_API_KEY`.

## Deploy to a free Hugging Face Space

1. Create a Space: **SDK = Docker**, hardware **CPU Basic (free)**. Visibility: public or private (a private Space needs an HF token, so public plus the bearer key is simpler).
2. Push the contents of this `inference/` folder to the Space repository.
3. In Space **Settings → Variables and secrets**, add the secret `INFERENCE_API_KEY`.
4. The image downloads both models at build time. Once it shows *Running*, the URL is `https://<user>-<space>.hf.space`.
5. Free Spaces sleep after about 48 hours without traffic. The first request after that waits for the container and models to load.

> **Not yet verified on Hugging Face.** The Docker image and the Space haven't been built or run yet (no HF account was available). Latency figures in [docs/inference-benchmark.md](../docs/inference-benchmark.md) come from a local Windows laptop, using the same llama.cpp build and model files.

Notes:
- Gemma 4's "thinking" mode is disabled per request (`LLM_ENABLE_THINKING=false`). With it on, a 25-token answer took over 2 minutes on CPU.
- Audio decoding uses PyAV directly. faster-whisper 1.2.1's own decoder fails with PyAV 19.

## Tests

```powershell
.\.venv\Scripts\python -m pytest -q
```

The tests use fake models, so they don't need the model files.
