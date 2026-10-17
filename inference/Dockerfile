# ReTrace inference service (Whisper small + Gemma 3 1B). Needs ~2.5 GB RAM; runs on CPU.
# Works on Railway (listens on $PORT) and Hugging Face Spaces (port 7860).
# Models are downloaded at build time so a restart doesn't re-download them.

# Debian 12: glibc 2.36 / libstdc++ GLIBCXX_3.4.30 satisfy the llama.cpp Ubuntu build
# (needs glibc 2.34, GLIBCXX_3.4.30; checked with objdump).
FROM python:3.11-slim-bookworm

ARG LLAMA_CPP_BUILD=b11696
ARG GGUF_URL=https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf
ARG WHISPER_MODEL=small

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates libgomp1 libstdc++6 libssl3 \
 && rm -rf /var/lib/apt/lists/*

# Run as an unprivileged user (Hugging Face Spaces require uid 1000).
RUN useradd -m -u 1000 app
WORKDIR /home/app/service

# llama.cpp CPU server (prebuilt release binary + its shared libraries)
RUN mkdir -p /opt/llama \
 && curl -fsSL "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_BUILD}/llama-${LLAMA_CPP_BUILD}-bin-ubuntu-x64.tar.gz" \
    | tar -xz -C /opt/llama --strip-components=1
ENV LD_LIBRARY_PATH=/opt/llama
RUN /opt/llama/llama-server --version

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /models && chown app /models
USER app
RUN curl -fsSL -o /models/gemma.gguf "${GGUF_URL}" \
 && echo "8ccc5cd1f1b3602548715ae25a66ed73fd5dc68a210412eea643eb20eb75a135  /models/gemma.gguf" | sha256sum -c -
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8', download_root='/models/whisper')"

COPY --chown=app app ./app
COPY --chown=app start.sh .

ENV WHISPER_MODEL=${WHISPER_MODEL} \
    WHISPER_DOWNLOAD_ROOT=/models/whisper \
    LLM_MODEL_PATH=/models/gemma.gguf \
    HF_HUB_OFFLINE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 7860
CMD ["sh", "start.sh"]
