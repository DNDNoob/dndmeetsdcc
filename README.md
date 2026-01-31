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
