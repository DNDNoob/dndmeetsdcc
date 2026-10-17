# "NPC Voices ON" desktop shortcut: starts NPC voices hidden in the background (restarting it if it was already running).
$ErrorActionPreference = 'Continue'
& (Join-Path $PSScriptRoot 'stop-windows.ps1') -KeepModels
Start-Process wscript.exe -ArgumentList "`"$(Join-Path $PSScriptRoot 'run-hidden.vbs')`""
Write-Host 'NPC voices is on.'
