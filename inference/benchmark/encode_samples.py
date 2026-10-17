"""Adds generator-like noise variants and encodes every sample to WebM/Opus (what browsers record).

Usage: python benchmark/encode_samples.py [samples_dir]
"""

import sys
import wave
from pathlib import Path

import av
import numpy as np

SR = 16_000
root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent.parent / ".models" / "samples")


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def write_wav(path: Path, samples: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(samples, -1, 1) * 32767).astype(np.int16).tobytes())


def generator_noise(n: int, rng: np.random.Generator) -> np.ndarray:
    """Engine-like noise: brown noise + 100 Hz hum with harmonics + a little hiss."""
    brown = np.cumsum(rng.normal(size=n))
    brown -= np.convolve(brown, np.ones(400) / 400, mode="same")
    t = np.arange(n) / SR
    hum = sum(np.sin(2 * np.pi * f * t) / k for k, f in enumerate([100, 200, 300, 400], start=1))
    noise = brown / (np.abs(brown).max() + 1e-9) + 0.6 * hum / np.abs(hum).max() + 0.1 * rng.normal(size=n)
    return noise / np.sqrt(np.mean(noise**2))


def add_noise(clean: np.ndarray, snr_db: float, rng: np.random.Generator) -> np.ndarray:
    speech_rms = np.sqrt(np.mean(clean**2))
    noise = generator_noise(len(clean), rng) * speech_rms / (10 ** (snr_db / 20))
    return clean + noise


def to_webm(wav_path: Path) -> Path:
    out_path = wav_path.with_suffix(".webm")
    with av.open(str(wav_path)) as src, av.open(str(out_path), "w", format="webm") as dst:
        stream = dst.add_stream("libopus", rate=48_000)
        stream.bit_rate = 32_000
        resampler = av.AudioResampler(format="s16", layout="mono", rate=48_000)
        for frame in src.decode(audio=0):
            for f in resampler.resample(frame):
                for packet in stream.encode(f):
                    dst.mux(packet)
        for packet in stream.encode(None):
            dst.mux(packet)
    return out_path


rng = np.random.default_rng(7)
for wav_path in sorted(root.glob("*.wav")):
    if wav_path.stem.endswith("-noisy"):
        continue
    clean = read_wav(wav_path)
    if not wav_path.stem.startswith("short"):
        write_wav(wav_path.with_name(f"{wav_path.stem}-noisy.wav"), add_noise(clean, 10, rng))

for wav_path in sorted(root.glob("*.wav")):
    webm = to_webm(wav_path)
    print(f"{webm.name}: {len(read_wav(wav_path)) / SR:.1f}s, {webm.stat().st_size / 1024:.0f} KB")
