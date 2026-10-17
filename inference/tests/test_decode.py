"""Decoding real encoded audio (regression: faster-whisper's decoder broke with PyAV 19)."""

import io

import av
import numpy as np
import pytest

from app.transcriber import AudioTooLongError, InvalidAudioError, decode_audio


def encode(seconds: float, fmt: str, codec: str, rate: int = 48_000) -> bytes:
    buf = io.BytesIO()
    with av.open(buf, "w", format=fmt) as out:
        stream = out.add_stream(codec, rate=rate)
        samples = (np.sin(2 * np.pi * 440 * np.arange(int(seconds * rate)) / rate) * 8000).astype(np.int16)
        for start in range(0, len(samples), 960):
            frame = av.AudioFrame.from_ndarray(samples[start : start + 960].reshape(1, -1), format="s16", layout="mono")
            frame.sample_rate = rate
            for packet in stream.encode(frame):
                out.mux(packet)
        for packet in stream.encode(None):
            out.mux(packet)
    return buf.getvalue()


@pytest.mark.parametrize("fmt,codec", [("webm", "libopus"), ("wav", "pcm_s16le"), ("mp4", "aac")])
def test_decodes_browser_formats_to_16k_mono(fmt, codec):
    samples = decode_audio(encode(2.0, fmt, codec), max_seconds=10)
    assert samples.dtype == np.float32
    assert abs(len(samples) / 16_000 - 2.0) < 0.15
    assert 0 < np.abs(samples).max() <= 1


def test_stops_decoding_audio_over_the_limit():
    with pytest.raises(AudioTooLongError):
        decode_audio(encode(4.0, "webm", "libopus"), max_seconds=2)


@pytest.mark.parametrize("data", [b"", b"not audio at all", b"\x1a\x45\xdf\xa3" + b"\x00" * 100])
def test_rejects_garbage(data):
    with pytest.raises(InvalidAudioError):
        decode_audio(data, max_seconds=10)
