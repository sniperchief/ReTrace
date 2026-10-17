#!/bin/sh
# Starts llama.cpp (Gemma) on localhost only, then the public API.
# The API listens on $PORT (set by Railway and most hosts), defaulting to 7860 (Hugging Face).
set -e

THREADS="${LLM_THREADS:-$(nproc)}"
# Gemma's internal port. Must differ from $PORT (Railway often assigns 8080).
LLM_PORT="${LLM_PORT:-8090}"
if [ "$LLM_PORT" = "${PORT:-7860}" ]; then LLM_PORT=8091; fi
export LLM_BASE_URL="http://127.0.0.1:${LLM_PORT}"

/opt/llama/llama-server \
  -m "${LLM_MODEL_PATH:-/models/gemma.gguf}" \
  --host 127.0.0.1 --port "$LLM_PORT" \
  --ctx-size "${LLM_CTX_SIZE:-4096}" \
  --threads "$THREADS" \
  --parallel 1 \
  --jinja &

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7860}" --workers 1
