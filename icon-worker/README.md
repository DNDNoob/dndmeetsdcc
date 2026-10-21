# Icon Worker

Cloudflare Worker that turns item and spell descriptions into pixel-art icons with Workers AI
(FLUX.1 schnell). It runs on Cloudflare's free plan (10,000 neurons a day, roughly 200 icons) and
keeps all credentials out of the web app.

## Deploy

```sh
cd icon-worker
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
```

Then set `VITE_ICON_API_URL=https://dndmeetsdcc-icons.icon-worker.workers.dev` (already the default in `src/lib/iconGen.ts`) for the app build.

When the daily allocation is used up the Worker answers `429 {"error":"quota"}` and the app falls back
to matching an existing icon from the shared `iconLibrary` collection by tags.
