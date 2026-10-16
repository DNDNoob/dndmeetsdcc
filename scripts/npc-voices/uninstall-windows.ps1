# Removes the NPC voices startup task and stops it. Leaves Ollama, the models and .env.npc alone.
$ErrorActionPreference = 'Continue'
Unregister-ScheduledTask -TaskName 'DnD NPC Voices' -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*npc-voices*index.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" | Where-Object { $_.CommandLine -like '*npc-voices*run.cmd*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Write-Host 'NPC voices removed from startup.'
