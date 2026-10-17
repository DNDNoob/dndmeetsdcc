# Removes the NPC voices startup task and desktop shortcuts, and stops it. Leaves Ollama, the models and .env.npc alone.
$ErrorActionPreference = 'Continue'
Unregister-ScheduledTask -TaskName 'DnD NPC Voices' -Confirm:$false -ErrorAction SilentlyContinue
& (Join-Path $PSScriptRoot 'stop-windows.ps1')
$desktop = [Environment]::GetFolderPath('Desktop')
Remove-Item (Join-Path $desktop 'NPC Voices ON.lnk'), (Join-Path $desktop 'NPC Voices OFF.lnk') -ErrorAction SilentlyContinue
Write-Host 'NPC voices removed from startup and the desktop.'
