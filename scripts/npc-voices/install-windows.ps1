# Installs NPC voices on a Windows PC so it starts automatically at sign-in.
# Usage (from the repo folder):
#   powershell -ExecutionPolicy Bypass -File scripts\npc-voices\install-windows.ps1 -DmUsername <your in-game username>
# Re-running is safe: it keeps the existing NPC account and refreshes the startup task.
param(
  [string]$DmUsername
)
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is not installed. Install the LTS version (winget install OpenJS.NodeJS.LTS) and run this again.' }
$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -lt 18) { throw "Node.js 18 or newer is required (found $(node --version))." }
if (-not (Test-Path (Join-Path $repo '.env'))) { throw 'Missing .env with the VITE_FIREBASE_* values at the repo root.' }

Write-Host 'Installing packages...'
npm ci --no-audit --no-fund | Out-Host

if (-not (Test-Path (Join-Path $repo '.env.npc'))) {
  if (-not $DmUsername) { throw 'First install needs -DmUsername <your in-game username>.' }
  node scripts\npc-voices\index.mjs --setup --dm $DmUsername | Out-Host
}

$taskName = 'DnD NPC Voices'
$vbs = Join-Path $repo 'scripts\npc-voices\run-hidden.vbs'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Makes NPCs talk in DnD meets DCC games using the local Ollama model.' -Force | Out-Null

# Restart it now so the latest code is running
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*npc-voices*index.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" | Where-Object { $_.CommandLine -like '*npc-voices*run.cmd*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-ScheduledTask -TaskName $taskName
Write-Host "Installed. NPC voices now starts when you sign in to Windows. Log: $repo\npc-voices.log"
