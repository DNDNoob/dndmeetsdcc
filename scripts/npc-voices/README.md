# NPC voices

Runs on the DM's computer and makes mobs with an **NPC Personality** talk in Show Time. It watches the DM's live campaigns in Firestore, asks a local [Ollama](https://ollama.com) model for one line of dialogue when something happens, and writes the line to the game chat. The app shows it in a speech bubble over the NPC.

This is the **Laptop** NPC brain: it answers with the local Ollama model only. The game also has an **Online** brain that runs in the DM's browser with free Groq/Gemini keys and needs no install; the DM picks one in the Game Chat settings. When the online brain runs out of free requests, this script covers if it is running. If no brain is available, the chat still works and NPCs stay quiet.

Both brains share the same engine in `src/lib/npc/` (`engine.mjs` for when and who speaks, `brain.mjs` for prompts, `onlineLlm.mjs` for Groq and Gemini). This script adds the Ollama model, the Windows task and keep-awake.

## One-time setup (Windows)

1. Install [Ollama](https://ollama.com) and pull the models:
   ```
   ollama pull qwen3:14b
   ollama pull qwen3:8b
   ```
2. Install Node.js 18 or newer (`winget install OpenJS.NodeJS.LTS`).
3. Clone this repo and put a `.env` at its root with the same `VITE_FIREBASE_*` values the web app uses.
4. From the repo folder run:
   ```
   powershell -ExecutionPolicy Bypass -File scripts\npc-voices\install-windows.ps1 -DmUsername <your in-game username>
   ```
   This installs packages, creates a dedicated NPC account (saved to `.env.npc`, which is git-ignored and stays on this computer), starts NPC voices, and puts **NPC Voices ON** and **NPC Voices OFF** shortcuts on the desktop. OFF also unloads the model to free memory. Add `-StartAtSignIn` if you want it to start by itself whenever you sign in to Windows.
5. The setup step prints the NPC account's uid. The Firestore rules must let that uid write `rooms/{roomId}/chatMessages` and `rooms/{roomId}/npcAi`.

To update after pulling new code, run the installer again (no `-DmUsername` needed). To remove it, run `scripts\npc-voices\uninstall-windows.ps1`.

Logs go to `npc-voices.log` in the repo folder.

## Running by hand (any OS)

```
node scripts/npc-voices/index.mjs --setup --dm <your in-game username>   # first time only
npm run npc-voices
```

## How it behaves

- Only runs model calls while the DM has an episode open in Show Time; otherwise it sleeps. It keeps the computer awake during a game.
- **Best quality** uses `qwen3:14b`, **Fast** uses `qwen3:8b` (DM picks in the chat settings). If there isn't enough free memory for Best quality it uses Fast and says so in the chat.
- Unloads the model after 15 minutes without activity.
- Secrets are only added to the prompt after the DM unlocks them.
- A Persuasion roll (from the crawler's profile) that meets the NPC's Persuasion DC asks the DM to unlock the secret; one try per crawler per NPC each noncombat turn.

## Settings (optional, in `.env.npc` or the environment)

`.env.npc` is git-ignored. Keep secrets there, never in `.env` or the code.

| Variable | Default | Meaning |
|----------|---------|---------|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama address |
| `NPC_MODEL_QUALITY` / `NPC_MODEL_FAST` | `qwen3:14b` / `qwen3:8b` | Models to use |
| `NPC_COOLDOWN_SECONDS` | `20` | Gap between lines from the same NPC |
| `NPC_IDLE_SECONDS` | `60` | Silence before an NPC may mutter |
| `NPC_NEAR_DISTANCE` | `12` | How close (map %) counts as "next to" an NPC |
| `NPC_UNLOAD_MINUTES` | `15` | Idle time before unloading the model |
| `NPC_QUALITY_MIN_FREE_GB` / `NPC_FAST_MIN_FREE_GB` | `6` / `2.5` | Free memory needed for each model |
