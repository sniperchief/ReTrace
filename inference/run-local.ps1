# Starts the local AI services in two new windows: Gemma (llama.cpp, :8080) and the API (:7860).
# Needs inference\.env (see .env.example) and the model files in inference\.models.
# Usage (from the ReTrace folder):  powershell -ExecutionPolicy Bypass -File inference\run-local.ps1
$here = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$here\.bin\llama\llama-server.exe' -m '$here\.models\gemma-4-E2B_q4_0-it.gguf' --host 127.0.0.1 --port 8080 --ctx-size 4096 --threads 2 --parallel 1 --jinja"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$here'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 7860 --workers 1"
Write-Output "Started. Gemma takes ~25 s to load; check http://127.0.0.1:7860/healthz (llmReady should be true)."
