# DND Meets DCC

## Project info

A D&D real-time multiplayer web app with map display, fog of war, mob/crawler management, and sound effects.

## How can I edit this code?

**Use your preferred IDE**

Clone this repo and push changes. The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Firebase (Firestore + Auth)

## Sound Effects Server (local option)

A small optional server is included to enable site-wide sound uploads. Features:

- Upload endpoint (POST /upload) which saves files in `server/uploads` and serves them at `/uploads/<filename>`

To enable searching a large public sound database (Freesound), set the environment variable `FREESOUND_API_KEY` on the server (not the frontend) and, if different, set `VITE_SOUND_API_BASE` on the frontend to the server base URL.

## How can I deploy this project?

The project deploys automatically to GitHub Pages on push to `main` via the GitHub Actions workflow in `.github/workflows/deploy.yml`.

## AI Coding Instructions

This project is exclusively coded by AI. Custom instructions are set up so that AI tools automatically follow the project's conventions.

### How Each Tool Finds Instructions

| AI Tool | Instruction File | Auto-loaded? |
|---------|-----------------|--------------|
| **Claude Code** (VS Code extension or CLI) | `CLAUDE.md` (repo root) | ✅ Yes — automatically read on every interaction |
| **GitHub Copilot Chat** (VS Code / GitHub.com) | `.github/copilot-instructions.md` | ✅ Yes — automatically included in every Copilot request |
| **GitHub Copilot Coding Agent** (GitHub Issues/PRs) | `CLAUDE.md` + `.github/copilot-instructions.md` | ✅ Yes — reads both files automatically |
| **Cursor IDE** | Create `.cursorrules` or `.cursor/rules/` | ❌ Not set up yet — copy from `CLAUDE.md` if needed |

### No Extra Setup Required

- **GitHub Copilot** (agent or chat): The `.github/copilot-instructions.md` file is automatically included in Copilot's context. No settings changes needed.
- **Claude Code** (via VS Code or CLI): The `CLAUDE.md` file at the repo root is automatically read when Claude Code opens the project. No settings changes needed.
- **GitHub Copilot Coding Agent**: Reads both `CLAUDE.md` and `.github/copilot-instructions.md` automatically when working on issues/PRs.
- Both files are checked into version control, so all contributors get the same AI behavior.
