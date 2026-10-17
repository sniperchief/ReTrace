import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.llm import Generation, LlmClient, LlmTimeoutError, LlmUnavailableError
from app.main import app
from app.transcriber import AudioTooLongError, InvalidAudioError, Transcript

KEY = "k" * 40
AUTH = {"Authorization": f"Bearer {KEY}"}


class FakeTranscriber:
    loaded = True

    def __init__(self, result=None, raises=None):
        self.result, self.raises, self.calls = result, raises, 0

    def transcribe(self, audio: bytes):
        self.calls += 1
        if self.raises:
            raise self.raises
        return self.result


class FakeLlm:
    def __init__(self, content='{"a": 1}', raises=None):
        self.content, self.raises, self.seen = content, raises, None

    def healthy(self):
        return True

    def generate_json(self, instructions, text, schema):
        self.seen = (instructions, text, schema)
        if self.raises:
            raise self.raises
        return Generation(content=self.content, model="gemma-test", processing_ms=5, prompt_tokens=10, completion_tokens=3)


@pytest.fixture
def client():
    settings = Settings(inference_api_key=KEY, max_audio_bytes=1000, max_text_chars=200)
    app.dependency_overrides[get_settings] = lambda: settings
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    for attr in ("transcriber", "llm"):
        if hasattr(app.state, attr):
            delattr(app.state, attr)


def use(transcriber=None, llm=None):
    if transcriber:
        app.state.transcriber = transcriber
    if llm:
        app.state.llm = llm


def test_requires_bearer_key(client):
    use(FakeTranscriber(), FakeLlm())
    assert client.post("/v1/transcribe", content=b"x").status_code == 401
    assert client.post("/v1/transcribe", content=b"x", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/v1/extract", json={}).status_code == 401


def test_healthz_is_public(client):
    use(FakeTranscriber(), FakeLlm())
    assert client.get("/healthz").json() == {"status": "ok", "whisperLoaded": True, "llmReady": True}


def test_transcribe_success(client):
    fake = FakeTranscriber(Transcript("Changed the plug.", 4.2, "en", "whisper-small", 1234))
    use(fake)
    res = client.post("/v1/transcribe", content=b"audio-bytes", headers=AUTH)
    assert res.status_code == 200
    assert res.json() == {
        "text": "Changed the plug.",
        "durationSec": 4.2,
        "language": "en",
        "model": "whisper-small",
        "processingMs": 1234,
    }


def test_transcribe_rejects_oversized_audio_without_running_model(client):
    fake = FakeTranscriber()
    use(fake)
    res = client.post("/v1/transcribe", content=b"x" * 1001, headers=AUTH)
    assert res.status_code == 413
    assert res.json()["detail"]["code"] == "audio_too_large"
    assert fake.calls == 0


@pytest.mark.parametrize(
    "exc,status,code",
    [
        (AudioTooLongError(400), 422, "audio_too_long"),
        (InvalidAudioError("bad"), 400, "invalid_audio"),
    ],
)
def test_transcribe_errors(client, exc, status, code):
    use(FakeTranscriber(raises=exc))
    res = client.post("/v1/transcribe", content=b"audio", headers=AUTH)
    assert res.status_code == status
    assert res.json()["detail"]["code"] == code


def test_transcribe_rejects_empty_body(client):
    use(FakeTranscriber())
    assert client.post("/v1/transcribe", content=b"", headers=AUTH).status_code == 400


def test_extract_passes_schema_and_returns_raw_text(client):
    llm = FakeLlm(content='{"diagnosis": null}')
    use(llm=llm)
    schema = {"type": "object"}
    res = client.post("/v1/extract", json={"instructions": "Extract.", "text": "notes", "schema": schema}, headers=AUTH)
    assert res.status_code == 200
    assert res.json()["content"] == '{"diagnosis": null}'
    assert llm.seen == ("Extract.", "notes", schema)


@pytest.mark.parametrize(
    "exc,status",
    [(LlmUnavailableError("down"), 503), (LlmTimeoutError("slow"), 504)],
)
def test_extract_maps_llm_failures(client, exc, status):
    use(llm=FakeLlm(raises=exc))
    res = client.post("/v1/extract", json={"instructions": "x", "text": "y", "schema": {}}, headers=AUTH)
    assert res.status_code == status


def test_extract_limits_text_length(client):
    use(llm=FakeLlm())
    res = client.post("/v1/extract", json={"instructions": "x", "text": "y" * 201, "schema": {}}, headers=AUTH)
    assert res.status_code == 413


def test_llm_client_sends_constrained_request():
    seen = {}

    def handler(request: httpx.Request):
        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}], "usage": {"prompt_tokens": 1}})

    client = LlmClient(Settings(inference_api_key=KEY), transport=httpx.MockTransport(handler))
    result = client.generate_json("sys", "notes", {"type": "object"})
    assert result.content == "{}"
    assert seen["temperature"] == 0
    assert seen["chat_template_kwargs"] == {"enable_thinking": False}
    assert seen["response_format"]["json_schema"]["schema"] == {"type": "object"}


def test_llm_client_reports_unavailable_server():
    def handler(request):
        raise httpx.ConnectError("refused")

    client = LlmClient(Settings(inference_api_key=KEY), transport=httpx.MockTransport(handler))
    with pytest.raises(LlmUnavailableError):
        client.generate_json("sys", "notes", {})
