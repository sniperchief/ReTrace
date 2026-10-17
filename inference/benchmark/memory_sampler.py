"""Samples resident memory (RSS) of the inference processes until stopped; prints peaks.

Usage: python benchmark/memory_sampler.py <seconds> [process-name-substring ...]
"""

import sys
import time

import psutil

duration = float(sys.argv[1])
names = sys.argv[2:] or ["llama-server", "uvicorn", "python"]
peak: dict[str, int] = {}
end = time.time() + duration
while time.time() < end:
    for proc in psutil.process_iter(["pid", "name", "cmdline", "memory_info"]):
        cmd = " ".join(proc.info["cmdline"] or [])
        label = next((n for n in names if n in (proc.info["name"] or "") or n in cmd), None)
        if not label or "memory_sampler" in cmd:
            continue
        key = f"{label} (pid {proc.info['pid']})"
        rss = proc.info["memory_info"].rss if proc.info["memory_info"] else 0
        peak[key] = max(peak.get(key, 0), rss)
    total = psutil.virtual_memory()
    peak["system used"] = max(peak.get("system used", 0), total.total - total.available)
    time.sleep(0.5)

for key, value in sorted(peak.items()):
    print(f"PEAK {key}: {value / 2**20:.0f} MiB", flush=True)
