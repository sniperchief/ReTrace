#!/bin/sh
# Starts llama.cpp (Gemma) on localhost only, then the public API.
# The API listens on $PORT (set by Railway and most hosts), defaulting to 7860 (Hugging Face).
set -e

THREADS="${LLM_THREADS:-$(nproc)}"

/opt/llama/llama-server \
  -m "${LLM_MODEL_PATH:-/models/gemma.gguf}" \
  --host 127.0.0.1 --port 8080 \
  --ctx-size "${LLM_CTX_SIZE:-4096}" \
  --threads "$THREADS" \
  --parallel 1 \
  --jinja &

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7860}" --workers 1
