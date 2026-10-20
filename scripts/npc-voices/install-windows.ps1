# Installs NPC voices on a Windows PC with "NPC Voices ON" / "NPC Voices OFF" desktop shortcuts.
# Usage (from the repo folder):
#   powershell -ExecutionPolicy Bypass -File scripts\npc-voices\install-windows.ps1 -DmUsername <your in-game username>
# Add -StartAtSignIn to also start it automatically whenever you sign in to Windows.
# Re-running is safe: it keeps the existing NPC account and refreshes the shortcuts.
param(
  [string]$DmUsername,
  [switch]$StartAtSignIn
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
if ($StartAtSignIn) {
  $vbs = Join-Path $repo 'scripts\npc-voices\run-hidden.vbs'
  $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`"" -WorkingDirectory $repo
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Makes NPCs talk in DnD meets DCC games using the local Ollama model.' -Force | Out-Null
} else {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

# Desktop shortcuts to turn it on and off
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
foreach ($s in @(@{ Name = 'NPC Voices ON'; Script = 'start-windows.ps1'; Icon = 'imageres.dll,101' },
                 @{ Name = 'NPC Voices OFF'; Script = 'stop-windows.ps1'; Icon = 'imageres.dll,100' })) {
  $lnk = $shell.CreateShortcut((Join-Path $desktop "$($s.Name).lnk"))
  $lnk.TargetPath = 'powershell.exe'
  $lnk.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $repo "scripts\npc-voices\$($s.Script)")`""
  $lnk.WorkingDirectory = "$repo"
  $lnk.IconLocation = $s.Icon
  $lnk.Save()
}

# Restart it now so the latest code is running
& (Join-Path $repo 'scripts\npc-voices\start-windows.ps1')
$when = if ($StartAtSignIn) { 'It also starts when you sign in to Windows.' } else { 'Use the NPC Voices ON / OFF shortcuts on your desktop.' }
Write-Host "Installed and running. $when Log: $repo\npc-voices.log"
