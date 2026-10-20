@echo off
rem Runs NPC voices forever, restarting it if it stops. Started hidden by run-hidden.vbs at logon.
cd /d "%~dp0..\.."
:loop
for %%F in (npc-voices.log) do if %%~zF GTR 5000000 move /y npc-voices.log npc-voices.old.log >nul
node scripts\npc-voices\index.mjs >> npc-voices.log 2>&1
timeout /t 30 /nobreak >nul
goto loop
