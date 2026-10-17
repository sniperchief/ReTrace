# ReTrace inference service for a free Hugging Face Docker Space (CPU Basic: 2 vCPU, 16 GB RAM).
# Models are downloaded at build time so a restart doesn't re-download them.
FROM python:3.11-slim

ARG LLAMA_CPP_BUILD=b11696
ARG GGUF_URL=https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/resolve/main/gemma-4-E2B_q4_0-it.gguf
ARG WHISPER_MODEL=small

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates libgomp1 \
 && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run as uid 1000.
RUN useradd -m -u 1000 app
WORKDIR /home/app/service

# llama.cpp CPU server (prebuilt release binary)
RUN mkdir -p /opt/llama \
 && curl -fsSL "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_BUILD}/llama-${LLAMA_CPP_BUILD}-bin-ubuntu-x64.tar.gz" \
    | tar -xz -C /opt/llama --strip-components=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /models && chown app /models
USER app
RUN curl -fsSL -o /models/gemma.gguf "${GGUF_URL}"
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8', download_root='/models/whisper')"

COPY --chown=app app ./app
COPY --chown=app start.sh .

ENV WHISPER_MODEL=${WHISPER_MODEL} \
    WHISPER_DOWNLOAD_ROOT=/models/whisper \
    LLM_BASE_URL=http://127.0.0.1:8080 \
    LLM_MODEL_PATH=/models/gemma.gguf \
    HF_HUB_OFFLINE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 7860
CMD ["sh", "start.sh"]
