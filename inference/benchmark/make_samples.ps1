# Generates synthetic test recordings with Windows text-to-speech (16 kHz mono WAV).
# These are NOT representative of real technicians (accent, noise, phrasing); see README.
param([string]$OutDir = "$PSScriptRoot\..\.models\samples")
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force $OutDir | Out-Null
$samples = Get-Content "$PSScriptRoot\samples.json" -Raw | ConvertFrom-Json
foreach ($s in $samples) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $synth.SelectVoice($s.voice)
  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $path = Join-Path $OutDir "$($s.id).wav"
  $synth.SetOutputToWaveFile($path, $format)
  $synth.Speak($s.text)
  $synth.Dispose()
  Write-Output "$path"
}
