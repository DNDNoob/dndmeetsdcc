import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";

// load server/.env if present (kept out of git via .gitignore)
const envPath = path.join(process.cwd(), "server", ".env");
if (fs.existsSync(envPath)) {
  const envContents = fs.readFileSync(envPath, "utf8");
  envContents.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let val = m[2] || "";
      // remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  });
}

// Informative startup log (do NOT print secret value)
const FREESOUND_ENV_VARS = [
  'FREESOUND_API_KEY',
  'NETLIFY_FREESOUND_API_KEY',
  'GITHUB_FREESOUND_API_KEY',
  'NEXT_PUBLIC_FREESOUND_API_KEY',
  'VITE_FREESOUND_API_KEY'
];
const FREESOUND_CONFIGURED = FREESOUND_ENV_VARS.some((n) => !!process.env[n]);
if (FREESOUND_CONFIGURED) {
  console.log('FREESOUND_API_KEY: configured via environment (including Netlify/GitHub Actions/Vite)');
} else {
  console.warn('FREESOUND_API_KEY is not configured — Freesound search will fall back to local samples. Set server/.env or provide the variable in your deployment.');
}

const UPLOAD_DIR = path.join(process.cwd(), "server", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const GAME_DATA_FILE = path.join(process.cwd(), "server", "game-data.json");

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for map images
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url, name: req.body.name || req.file.originalname, id: Date.now().toString() });
});

app.get("/health", (req, res) => res.json({ ok: true, freesound: FREESOUND_CONFIGURED }));

// Simple in-memory cache and rate limiter
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const cache = new Map(); // key -> { ts, data }
const rateWindowMs = 60 * 1000; // per minute
const rateLimitCount = 60; // requests per IP per window
const rateMap = new Map(); // ip -> { windowStart, count }

// Local sample sounds (fallback if no Freesound key)
const LOCAL_SOUNDS = [
  { id: "mixkit-2792", name: "Sword Slash", url: "https://assets.mixkit.co/active_storage/sfx/2792/2792.wav", tags: ["combat","sword"], source: "local" },
  { id: "mixkit-2566", name: "Magic Spell", url: "https://assets.mixkit.co/active_storage/sfx/2566/2566.wav", tags: ["magic","spell"], source: "local" },
  { id: "mixkit-2403", name: "Door Creak", url: "https://assets.mixkit.co/active_storage/sfx/2403/2403.wav", tags: ["door","ambient"], source: "local" },
  { id: "mixkit-2462", name: "Footsteps", url: "https://assets.mixkit.co/active_storage/sfx/2462/2462.wav", tags: ["footsteps","movement"], source: "local" },
  { id: "mixkit-1997", name: "Coin Drop", url: "https://assets.mixkit.co/active_storage/sfx/1997/1997.wav", tags: ["coin","treasure"], source: "local" },
];

// Game data save endpoint
app.post('/api/game/save', (req, res) => {
  try {
    fs.writeFileSync(GAME_DATA_FILE, JSON.stringify(req.body, null, 2));
    console.log('Game data saved successfully');
    res.json({ success: true });
  } catch (e) {
    console.error('Failed to save game data:', e);
    res.status(500).json({ error: e.message });
  }
});

// Game data load endpoint
app.get('/api/game/load', (req, res) => {
  try {
    if (fs.existsSync(GAME_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(GAME_DATA_FILE, 'utf8'));
      console.log('Game data loaded successfully');
      res.json(data);
    } else {
      console.log('No saved game data found');
      res.json(null);
    }
  } catch (e) {
    console.error('Failed to load game data:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sounds/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString();
    const page = parseInt((req.query.page || '1').toString()) || 1;
    const page_size = Math.min(parseInt((req.query.page_size || '50').toString()) || 50, 150);

    // rate limiting by IP
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const state = rateMap.get(ip) || { windowStart: now, count: 0 };
    if (now - state.windowStart > rateWindowMs) {
      state.windowStart = now;
      state.count = 0;
    }
    state.count++;
    rateMap.set(ip, state);
    if (state.count > rateLimitCount) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const key = `search:${q}:${page}:${page_size}`;
    const cached = cache.get(key);
    if (cached && (now - cached.ts) < CACHE_TTL) {
      return res.json({ source: 'cache', results: cached.data });
    }

    const FREESOUND_KEY = process.env.FREESOUND_API_KEY || process.env.NETLIFY_FREESOUND_API_KEY || process.env.GITHUB_FREESOUND_API_KEY || process.env.NEXT_PUBLIC_FREESOUND_API_KEY || process.env.VITE_FREESOUND_API_KEY;
    if (!FREESOUND_KEY) {
      // return local samples filtered by q
      const filtered = q ? LOCAL_SOUNDS.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || s.tags.some(t => t.includes(q.toLowerCase()))) : LOCAL_SOUNDS;
      cache.set(key, { ts: now, data: filtered });
      return res.json({ source: 'local', results: filtered });
    }

    // call Freesound API
    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&page=${page}&page_size=${page_size}&fields=id,name,previews,tags` + `&token=${FREESOUND_KEY}`;
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: 'Freesound fetch failed', detail: txt });
    }
    const json = await r.json();
    const mapped = (json.results || []).map((it) => ({
      id: `freesound-${it.id}`,
      name: it.name,
      url: (it.previews && (it.previews['preview-hq-mp3'] || it.previews['preview-lq-mp3'])) || '',
      tags: it.tags || [],
      source: 'freesound'
    })).filter(s => s.url);

    cache.set(key, { ts: now, data: mapped });
    return res.json({ source: 'freesound', results: mapped });
  } catch (e) {
    console.error('search error', e);
    res.status(500).json({ error: 'internal error' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // Broadcast to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (e) {
      console.error("Invalid message", e);
    }
  });

  ws.send(JSON.stringify({ type: "welcome" }));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Sound server running on port ${PORT}`));
