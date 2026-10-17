"""ReTrace inference service: Whisper transcription and Gemma JSON extraction.

Stateless. Holds no user data, writes nothing to disk, and only answers
requests carrying the shared bearer key.
"""

from __future__ import annotations

import hmac
import json
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from .config import Settings, get_settings
from .llm import LlmBadResponseError, LlmClient, LlmTimeoutError, LlmUnavailableError
from .transcriber import AudioTooLongError, InvalidAudioError, WhisperTranscriber

app = FastAPI(title="ReTrace inference", docs_url=None, redoc_url=None, openapi_url=None)


def get_transcriber(request: Request) -> WhisperTranscriber:
    if not hasattr(request.app.state, "transcriber"):
        request.app.state.transcriber = WhisperTranscriber(get_settings())
    return request.app.state.transcriber


def get_llm(request: Request) -> LlmClient:
    if not hasattr(request.app.state, "llm"):
        request.app.state.llm = LlmClient(get_settings())
    return request.app.state.llm


def require_key(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    expected = f"Bearer {settings.inference_api_key}"
    if not authorization or not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail={"code": "unauthorized"})


def error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


@app.get("/healthz")
def healthz(
    transcriber: Annotated[WhisperTranscriber, Depends(get_transcriber)],
    llm: Annotated[LlmClient, Depends(get_llm)],
) -> dict[str, Any]:
    # Unauthenticated on purpose (used as a wake-up ping); reveals no data.
    return {"status": "ok", "whisperLoaded": transcriber.loaded, "llmReady": llm.healthy()}


@app.post("/v1/transcribe", dependencies=[Depends(require_key)])
async def transcribe(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    transcriber: Annotated[WhisperTranscriber, Depends(get_transcriber)],
) -> dict[str, Any]:
    # Raw body (not multipart) so the audio stays in memory and is never
    # spooled to a temporary file; reading stops as soon as the limit is passed.
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > settings.max_audio_bytes:
            raise error(413, "audio_too_large", "Audio is larger than the allowed size.")
        chunks.append(chunk)
    data = b"".join(chunks)
    chunks.clear()
    if not data:
        raise error(400, "invalid_audio", "No audio was sent.")
    try:
        result = await run_in_threadpool(transcriber.transcribe, data)
    except AudioTooLongError as exc:
        raise error(422, "audio_too_long", f"Audio is {exc.seconds:.0f}s; the limit is {settings.max_audio_seconds:.0f}s.")
    except InvalidAudioError:
        raise error(400, "invalid_audio", "The audio could not be decoded.")
    finally:
        del data
    return {
        "text": result.text,
        "durationSec": result.duration_seconds,
        "language": result.language,
        "model": result.model,
        "processingMs": result.processing_ms,
    }


class ExtractRequest(BaseModel):
    instructions: str = Field(min_length=1, max_length=8000)
    text: str = Field(min_length=1)
    json_schema: dict[str, Any] = Field(alias="schema")


@app.post("/v1/extract", dependencies=[Depends(require_key)])
async def extract(
    body: ExtractRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    llm: Annotated[LlmClient, Depends(get_llm)],
) -> dict[str, Any]:
    if len(body.text) > settings.max_text_chars:
        raise error(413, "text_too_long", "The notes are too long.")
    if len(json.dumps(body.json_schema)) > settings.max_schema_bytes:
        raise error(413, "schema_too_large", "The schema is too large.")
    try:
        result = await run_in_threadpool(llm.generate_json, body.instructions, body.text, body.json_schema)
    except LlmTimeoutError:
        raise error(504, "llm_timeout", "The language model took too long.")
    except LlmUnavailableError:
        raise error(503, "llm_unavailable", "The language model is not available.")
    except LlmBadResponseError:
        raise error(502, "llm_bad_response", "The language model returned an unexpected response.")
    # The raw text is returned unparsed: the web app validates it.
    return {
        "content": result.content,
        "model": result.model,
        "processingMs": result.processing_ms,
        "promptTokens": result.prompt_tokens,
        "completionTokens": result.completion_tokens,
    }
