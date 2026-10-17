"""Gemma via an OpenAI-compatible chat endpoint (llama.cpp `llama-server`, or Ollama)."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from .config import Settings


class LlmUnavailableError(Exception):
    pass


class LlmTimeoutError(Exception):
    pass


class LlmBadResponseError(Exception):
    pass


@dataclass
class Generation:
    content: str
    model: str
    processing_ms: int
    prompt_tokens: int | None
    completion_tokens: int | None


class LlmClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None):
        self._settings = settings
        self._client = httpx.Client(
            base_url=settings.llm_base_url,
            timeout=httpx.Timeout(settings.llm_timeout_seconds, connect=5),
            transport=transport,
        )

    @property
    def model_name(self) -> str:
        return self._settings.llm_model

    def healthy(self) -> bool:
        try:
            return self._client.get("/health", timeout=3).status_code == 200
        except httpx.HTTPError:
            return False

    def generate_json(self, instructions: str, text: str, schema: dict[str, Any]) -> Generation:
        """Asks the model for JSON constrained to `schema`. Returns the raw text; the caller validates it."""
        body = {
            "model": self._settings.llm_model,
            "messages": [
                {"role": "system", "content": instructions},
                {"role": "user", "content": text},
            ],
            "temperature": 0,
            "max_tokens": self._settings.llm_max_tokens,
            # Gemma 4 "thinks" before answering by default. On a CPU that costs minutes
            # of hidden tokens and adds nothing to copying facts out of short notes.
            "chat_template_kwargs": {"enable_thinking": self._settings.llm_enable_thinking},
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "result", "strict": True, "schema": schema},
            },
        }
        started = time.perf_counter()
        try:
            response = self._client.post("/v1/chat/completions", json=body)
        except httpx.TimeoutException as exc:
            raise LlmTimeoutError(str(exc)) from exc
        except httpx.HTTPError as exc:
            raise LlmUnavailableError(str(exc)) from exc
        elapsed = int((time.perf_counter() - started) * 1000)

        if response.status_code >= 500 or response.status_code == 404:
            raise LlmUnavailableError(f"LLM server returned {response.status_code}")
        if response.status_code != 200:
            raise LlmBadResponseError(f"LLM server returned {response.status_code}")
        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LlmBadResponseError("unexpected response shape") from exc
        if not isinstance(content, str):
            raise LlmBadResponseError("content is not text")

        usage = data.get("usage") or {}
        return Generation(
            content=content,
            model=self._settings.llm_model,
            processing_ms=elapsed,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
        )
