# "NPC Voices OFF" desktop shortcut: stops NPC voices and unloads the Ollama model to free memory.
param([switch]$KeepModels)
$ErrorActionPreference = 'Continue'
Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" | Where-Object { $_.CommandLine -like '*npc-voices*run.cmd*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*npc-voices*index.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
if (-not $KeepModels) {
  $ollama = if ($env:OLLAMA_URL) { $env:OLLAMA_URL } else { 'http://127.0.0.1:11434' }
  try {
    $loaded = (Invoke-RestMethod -Uri "$ollama/api/ps" -TimeoutSec 5).models
    foreach ($m in $loaded) {
      Invoke-RestMethod -Uri "$ollama/api/generate" -Method Post -ContentType 'application/json' -TimeoutSec 30 `
        -Body (@{ model = $m.name; keep_alive = 0 } | ConvertTo-Json) | Out-Null
    }
  } catch {
    # Ollama isn't running, so nothing is loaded
  }
  Write-Host 'NPC voices is off.'
}
