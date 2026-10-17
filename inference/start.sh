#!/bin/sh
# Starts llama.cpp (Gemma) on localhost only, then the public API on :7860.
set -e

/opt/llama/llama-server \
  -m "${LLM_MODEL_PATH:-/models/gemma.gguf}" \
  --host 127.0.0.1 --port 8080 \
  --ctx-size "${LLM_CTX_SIZE:-4096}" \
  --threads "${LLM_THREADS:-2}" \
  --parallel 1 \
  --jinja &

exec uvicorn app.main:app --host 0.0.0.0 --port 7860 --workers 1
