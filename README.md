# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

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

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

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

## Sound Effects Server (local option)

A small optional server is included to enable site-wide sound broadcasts and uploads. Features:

- WebSocket broadcast for "play" events so all connected browsers will play the same sound
- Upload endpoint (POST /upload) which saves files in `server/uploads` and serves them at `/uploads/<filename>`

To run the server locally:

```sh
# install server dependencies
npm install --no-audit --no-fund express ws multer cors

# start the sound server
npm run start:sfx-server

# local env
Copy `server/.env.example` to `server/.env` and set `FREESOUND_API_KEY` to your Freesound API key (do NOT commit `server/.env`).
```

Then set `VITE_SOUND_WS_URL` and `VITE_SOUND_SERVER_BASE` if not `http://localhost:4000`.

To enable searching a large public sound database (Freesound), set the environment variable `FREESOUND_API_KEY` on the server (not the frontend) and, if different, set `VITE_SOUND_API_BASE` on the frontend to the server base URL.

The server proxy endpoint is `/api/sounds/search?q=<query>&page=1&page_size=50` and will be used automatically by the Sound Effects tab to populate results on open. This keeps the Freesound API key secret and avoids exposing it in browser bundles.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
