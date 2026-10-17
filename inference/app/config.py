"""Service configuration, read from environment variables (see .env.example)."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared secret; the web app sends it as `Authorization: Bearer <key>`.
    inference_api_key: str = Field(min_length=32)

    # Whisper (faster-whisper / CTranslate2)
    whisper_model: str = "small"
    whisper_compute_type: str = "int8"
    whisper_beam_size: int = 1
    whisper_cpu_threads: int = 0  # 0 = let CTranslate2 decide
    whisper_download_root: str | None = None

    # Gemma via a llama.cpp (or any OpenAI-compatible) server
    llm_base_url: str = "http://127.0.0.1:8080"
    llm_model: str = "gemma-4-e2b-it-qat-q4_0"
    llm_timeout_seconds: float = 240
    llm_max_tokens: int = 700
    llm_enable_thinking: bool = False

    # Limits
    max_audio_bytes: int = 4 * 1024 * 1024
    max_audio_seconds: float = 180
    max_text_chars: int = 8000
    max_schema_bytes: int = 16 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
