import type { Context, Config } from "@netlify/functions";

// Local sample sounds (fallback if no Freesound key)
const LOCAL_SOUNDS = [
  { id: "mixkit-2792", name: "Sword Slash", url: "https://assets.mixkit.co/active_storage/sfx/2792/2792.wav", tags: ["combat", "sword"], source: "local" },
  { id: "mixkit-2566", name: "Magic Spell", url: "https://assets.mixkit.co/active_storage/sfx/2566/2566.wav", tags: ["magic", "spell"], source: "local" },
  { id: "mixkit-2403", name: "Door Creak", url: "https://assets.mixkit.co/active_storage/sfx/2403/2403.wav", tags: ["door", "ambient"], source: "local" },
  { id: "mixkit-2462", name: "Footsteps", url: "https://assets.mixkit.co/active_storage/sfx/2462/2462.wav", tags: ["footsteps", "movement"], source: "local" },
  { id: "mixkit-1997", name: "Coin Drop", url: "https://assets.mixkit.co/active_storage/sfx/1997/1997.wav", tags: ["coin", "treasure"], source: "local" },
];

export default async (req: Request, context: Context) => {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page") || "1") || 1;
    const page_size = Math.min(parseInt(url.searchParams.get("page_size") || "50") || 50, 150);

    // Check for Freesound API key from environment
    const FREESOUND_KEY = Netlify.env.get("FREESOUND_API_KEY") ||
                          Netlify.env.get("NETLIFY_FREESOUND_API_KEY") ||
                          Netlify.env.get("VITE_FREESOUND_API_KEY");

    if (!FREESOUND_KEY) {
      // Return local samples filtered by query
      const filtered = q
        ? LOCAL_SOUNDS.filter(
            (s) =>
              s.name.toLowerCase().includes(q.toLowerCase()) ||
              s.tags.some((t) => t.includes(q.toLowerCase()))
          )
        : LOCAL_SOUNDS;
      return new Response(JSON.stringify({ source: "local", results: filtered }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call Freesound API
    const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&page=${page}&page_size=${page_size}&fields=id,name,previews,tags&token=${FREESOUND_KEY}`;

    const response = await fetch(freesoundUrl);

    if (!response.ok) {
      const txt = await response.text();
      return new Response(JSON.stringify({ error: "Freesound fetch failed", detail: txt }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    const mapped = (json.results || [])
      .map((it: any) => ({
        id: `freesound-${it.id}`,
        name: it.name,
        url: (it.previews && (it.previews["preview-hq-mp3"] || it.previews["preview-lq-mp3"])) || "",
        tags: it.tags || [],
        source: "freesound",
      }))
      .filter((s: any) => s.url);

    return new Response(JSON.stringify({ source: "freesound", results: mapped }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search error", e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/sounds/search",
};
