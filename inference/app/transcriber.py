"""Speech-to-text with faster-whisper. Audio is decoded in memory and never written to disk."""

from __future__ import annotations

import io
import os
import threading
import time
from dataclasses import dataclass

import numpy as np

from .config import Settings

# Words technicians use that Whisper may not expect. Passed as context, not as output.
VOCABULARY_HINT = (
    "Generator repair notes. Sumec Firman, Elepaq, Tiger, Lutian, Thermocool, Mikano, Perkins. "
    "AVR, carburettor, spark plug, plug, coil, ignition coil, recoil starter, starter, rewinding, "
    "stator, rotor, brushes, capacitor, diode, fuel pump, injector, piston, rings, gasket, "
    "air filter, fuel filter, oil seal, kVA, naira."
)

SAMPLE_RATE = 16_000


class AudioTooLongError(Exception):
    def __init__(self, seconds: float):
        super().__init__(f"audio is {seconds:.0f}s long")
        self.seconds = seconds


class InvalidAudioError(Exception):
    pass


@dataclass
class Transcript:
    text: str
    duration_seconds: float
    language: str
    model: str
    processing_ms: int


def decode_audio(data: bytes, max_seconds: float) -> np.ndarray:
    """Decodes any container PyAV understands to 16 kHz mono float32, in memory.

    Stops as soon as the audio exceeds `max_seconds`, so a small file that
    expands to hours of audio can't exhaust memory.
    """
    import av

    limit = int(max_seconds * SAMPLE_RATE)
    chunks: list[np.ndarray] = []
    total = 0
    try:
        with av.open(io.BytesIO(data), mode="r") as container:
            if not container.streams.audio:
                raise InvalidAudioError("no audio stream")
            resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
            for frame in container.decode(container.streams.audio[0]):
                for out in resampler.resample(frame):
                    chunk = out.to_ndarray().reshape(-1)
                    chunks.append(chunk)
                    total += len(chunk)
                if total > limit:
                    raise AudioTooLongError(total / SAMPLE_RATE)
            for out in resampler.resample(None):
                chunks.append(out.to_ndarray().reshape(-1))
    except (AudioTooLongError, InvalidAudioError):
        raise
    except Exception as exc:  # PyAV raises many error types for bad input
        raise InvalidAudioError(str(exc)) from exc
    if not chunks:
        raise InvalidAudioError("no audio frames")
    return np.concatenate(chunks).astype(np.float32) / 32768.0


class WhisperTranscriber:
    """Loads the model lazily and serialises requests (the free CPU host has 2 vCPUs)."""

    def __init__(self, settings: Settings):
        self._settings = settings
        self._model = None
        self._load_lock = threading.Lock()
        self._run_lock = threading.Lock()

    @property
    def model_name(self) -> str:
        # WHISPER_MODEL may be a size ("small") or a local folder (".models/whisper-small").
        name = os.path.basename(self._settings.whisper_model.rstrip("/\\"))
        return name if name.startswith("whisper-") else f"whisper-{name}"

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self):
        with self._load_lock:
            if self._model is None:
                from faster_whisper import WhisperModel

                self._model = WhisperModel(
                    self._settings.whisper_model,
                    device="cpu",
                    compute_type=self._settings.whisper_compute_type,
                    cpu_threads=self._settings.whisper_cpu_threads,
                    download_root=self._settings.whisper_download_root,
                )
        return self._model

    def transcribe(self, audio: bytes) -> Transcript:
        samples = decode_audio(audio, self._settings.max_audio_seconds)
        duration = len(samples) / SAMPLE_RATE
        if duration < 0.3:
            raise InvalidAudioError("audio is empty")

        model = self.load()
        with self._run_lock:
            started = time.perf_counter()
            segments, info = model.transcribe(
                samples,
                language="en",  # auto-detection misfires on Nigerian English
                task="transcribe",
                beam_size=self._settings.whisper_beam_size,
                vad_filter=True,
                initial_prompt=VOCABULARY_HINT,
                condition_on_previous_text=False,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            elapsed = int((time.perf_counter() - started) * 1000)

        return Transcript(
            text=text,
            duration_seconds=round(duration, 2),
            language=info.language,
            model=self.model_name,
            processing_ms=elapsed,
        )
