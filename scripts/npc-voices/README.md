# NPC voices

Runs on the DM's computer and makes mobs with an **NPC Personality** talk in Show Time. It watches the DM's live campaigns in Firestore, asks a local [Ollama](https://ollama.com) model for one line of dialogue when something happens, and writes the line to the game chat. The app shows it in a speech bubble over the NPC.

Nothing is sent to an outside AI service. If this computer is off, the chat still works and NPCs stay quiet.

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
   This installs packages, creates a dedicated NPC account (saved to `.env.npc`, which is git-ignored and stays on this computer), and registers a **DnD NPC Voices** startup task that runs hidden whenever you sign in to Windows.
5. The setup step prints the NPC account's uid. The Firestore rules must let that uid write `rooms/{roomId}/chatMessages` and `rooms/{roomId}/npcAi`.

To update after pulling new code, run the installer again (no `-DmUsername` needed). To remove it, run `scripts\npc-voices\uninstall-windows.ps1`.

Logs go to `npc-voices.log` in the repo folder.

## Running by hand (any OS)

```
node scripts/npc-voices/index.mjs --setup --dm <your in-game username>   # first time only
npm run npc-voices
```

## How it behaves

- Only runs model calls while a Show Time game is live; otherwise it sleeps. It keeps the computer awake during a game.
- **Best quality** uses `qwen3:14b`, **Fast** uses `qwen3:8b` (DM picks in the chat settings). If there isn't enough free memory for Best quality it uses Fast and says so in the chat.
- Unloads the model after 15 minutes without activity.
- Secrets are only added to the prompt after the DM unlocks them.

## Settings (optional, in `.env.npc` or the environment)

| Variable | Default | Meaning |
|----------|---------|---------|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama address |
| `NPC_MODEL_QUALITY` / `NPC_MODEL_FAST` | `qwen3:14b` / `qwen3:8b` | Models to use |
| `NPC_COOLDOWN_SECONDS` | `20` | Gap between lines from the same NPC |
| `NPC_IDLE_SECONDS` | `60` | Silence before an NPC may mutter |
| `NPC_NEAR_DISTANCE` | `12` | How close (map %) counts as "next to" an NPC |
| `NPC_UNLOAD_MINUTES` | `15` | Idle time before unloading the model |
| `NPC_QUALITY_MIN_FREE_GB` / `NPC_FAST_MIN_FREE_GB` | `6` / `2.5` | Free memory needed for each model |
