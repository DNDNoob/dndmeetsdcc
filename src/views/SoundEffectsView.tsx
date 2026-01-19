import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Volume2, Search, Play, Star, Upload } from "lucide-react";
import { useFirebaseStore } from "@/hooks/useFirebaseStore";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

interface SoundEffect extends Record<string, unknown> {
  id: string;
  name: string;
  url: string;
  tags: string[];
  isFavorite?: boolean;
  source?: string;
}

const LOCAL_SOUNDS: SoundEffect[] = [
  { id: "1", name: "Sword Slash", url: "https://assets.mixkit.co/active_storage/sfx/2792/2792.wav", tags: ["combat", "weapon", "sword"], source: "local" },
  { id: "2", name: "Magic Spell", url: "https://assets.mixkit.co/active_storage/sfx/2566/2566.wav", tags: ["magic", "spell", "casting"], source: "local" },
  { id: "3", name: "Door Creak", url: "https://assets.mixkit.co/active_storage/sfx/2403/2403.wav", tags: ["door", "spooky", "ambient"], source: "local" },
  { id: "4", name: "Footsteps", url: "https://assets.mixkit.co/active_storage/sfx/2462/2462.wav", tags: ["movement", "steps", "walking"], source: "local" },
  { id: "5", name: "Coin Drop", url: "https://assets.mixkit.co/active_storage/sfx/1997/1997.wav", tags: ["treasure", "gold", "money"], source: "local" },
];

const SOUND_WS_URL = (import.meta.env.VITE_SOUND_WS_URL as string) || "";
const FREESOUND_KEY = (import.meta.env.VITE_FREESOUND_API_KEY as string) || "";

const RECENT_KEY = "sfx_recent";
const FAV_KEY = "sfx_favs";

function cleanSoundName(name: string): string {
  // Remove common prefixes like numbers, underscores, hyphens at the start
  let cleaned = name.replace(/^[\d_\-\s]+/, '');
  
  // Remove file extensions
  cleaned = cleaned.replace(/\.(wav|mp3|ogg|flac)$/i, '');
  
  // Replace underscores and hyphens with spaces
  cleaned = cleaned.replace(/[_\-]/g, ' ');
  
  // Capitalize first letter of each word
  cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  
  // Trim any extra whitespace
  cleaned = cleaned.trim();
  
  return cleaned || name; // Fallback to original if cleaning results in empty string
}

const SoundEffectsView: React.FC = () => {
  const { getCollection, addItem, deleteItem, isLoaded } = useFirebaseStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SoundEffect[]>(LOCAL_SOUNDS);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recent, setRecent] = useState<SoundEffect[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
  });
  const wsRef = useRef<WebSocket | null>(null);

  // Get favorites and uploaded from Firebase
  const allSoundEffects = getCollection<SoundEffect>('soundEffects');
  const favorites = allSoundEffects.filter(s => s.isFavorite);
  const uploaded = allSoundEffects.filter(s => s.source === 'uploaded');

  // Debug logging
  useEffect(() => {
    console.log('Sound effects from Firebase:', allSoundEffects.length);
    console.log('Uploaded sounds:', uploaded);
    console.log('Favorites:', favorites.length);
  }, [allSoundEffects.length, uploaded.length, favorites.length]);

  // Ensure uploaded sounds are included when they change
  useEffect(() => {
    if (uploaded.length > 0 && !searchQuery.trim()) {
      // If search is empty and we have uploaded sounds, show them with recent or local
      setResults([...uploaded, ...(recent.length > 0 ? recent : LOCAL_SOUNDS)]);
    }
  }, [uploaded.length]);

  useEffect(() => {
    // Connect to sound broadcast websocket if available (use /ws on same origin when not configured)
    try {
      const wsUrl =
        SOUND_WS_URL ||
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log("Connected to sound server");
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "play") {
            playSoundLocal({ id: data.id, name: data.name, url: data.url, tags: data.tags || [], source: data.source || "remote" }, false);
          }
        } catch (e) {
          // ignore
        }
      };
      wsRef.current = ws;
      return () => ws.close();
    } catch (e) {
      console.warn("No sound server available at", SOUND_WS_URL || "/ws");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
  }, [recent]);

  useEffect(() => {
    let active = true;
    let timer: any = null;
    const doSearch = async () => {
      const q = searchQuery.trim();
      
      // Show recent sounds when search is empty
      if (!q) {
        if (active) setResults(recent.length > 0 ? recent : [...uploaded, ...LOCAL_SOUNDS]);
        return;
      }
      
      const base = (import.meta.env.VITE_SOUND_API_BASE as string) || (import.meta.env.VITE_SOUND_SERVER_BASE as string) || '';
      const url = `${base}/api/sounds/search?q=${encodeURIComponent(q)}&page=1&page_size=60`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn('search proxy failed', await res.text());
          // fallback to local
          const fallback = [...uploaded, ...LOCAL_SOUNDS];
          if (active) setResults(fallback);
          return;
        }
        const json = await res.json();
        if (!active) return;
        const mapped: SoundEffect[] = (json.results || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          url: r.url,
          tags: r.tags || [],
          source: r.source || json.source || 'proxy'
        }));
        setResults([...uploaded, ...mapped]);
      } catch (e) {
        console.error('proxy search failed', e);
        if (active) setResults([...uploaded, ...LOCAL_SOUNDS]);
      }
    };

    // debounce user input
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [searchQuery, uploaded, recent]);

  // Auto-load on mount (populate results when tab opened)
  useEffect(() => {
    if (!searchQuery.trim()) {
      // trigger search effect
      setSearchQuery('');
    }
  }, []);

  const playSoundLocal = (sound: SoundEffect, broadcast = true) => {
    setPlayingId(sound.id);
    const audio = new Audio(sound.url);
    audio.play().catch((e) => console.warn("Failed to play", e));
    audio.onended = () => setPlayingId(null);

    // update recent
    setRecent((prev) => {
      const without = prev.filter((p) => p.url !== sound.url);
      return [sound, ...without].slice(0, 10);
    });

    // broadcast to server so all clients play
    if (broadcast && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "play", id: sound.id, name: sound.name, url: sound.url, tags: sound.tags, source: sound.source }));
    }
  };

  const handlePlayClick = (sound: SoundEffect) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // send to server to broadcast
      wsRef.current.send(JSON.stringify({ type: "play", id: sound.id, name: sound.name, url: sound.url, tags: sound.tags, source: sound.source }));
    } else {
      playSoundLocal(sound, false);
    }
  };

  const toggleFavorite = async (sound: SoundEffect) => {
    const exists = favorites.find((f) => f.url === sound.url);
    if (exists) {
      // Remove from favorites
      await deleteItem('soundEffects', exists.id);
    } else {
      // Add to favorites
      const newFavorite = { ...sound, isFavorite: true, id: sound.id || crypto.randomUUID() };
      await addItem('soundEffects', newFavorite);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file?: File) => {
    const f = file || (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files[0]);
    if (!f) return;
    setUploading(true);
    try {
      // Upload to Firebase Storage
      const fileRef = storageRef(storage, `sound-effects/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`);
      await uploadBytes(fileRef, f);
      const url = await getDownloadURL(fileRef);
      const s: SoundEffect = {
        id: crypto.randomUUID(),
        name: f.name,
        url,
        tags: [],
        source: 'uploaded',
        isFavorite: true
      };
      await addItem('soundEffects', s);
    } catch (e) {
      console.error("Upload failed", e);
    }
    setUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Deduplicate only for sound card rendering
  const soundCardResults = Array.from(
    new Map(results.map(item => [item.id, item])).values()
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Sound Effects Library</h1>
      </div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search sounds..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {soundCardResults.map((sound) => (
              <div key={sound.id} className="border border-border bg-muted/20 p-4 hover:bg-primary/5 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display text-foreground">{cleanSoundName(sound.name)}</h3>
                  <div className="text-xs text-muted-foreground">{sound.source}</div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {sound.tags.map((tag, index) => (
                    <span key={index} className="text-xs bg-primary/10 text-primary px-2 py-0.5">{tag}</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <DungeonButton variant={playingId === sound.id ? "admin" : "default"} size="sm" className="flex-1" onClick={() => handlePlayClick(sound)} disabled={playingId === sound.id}>
                    <Play className="w-4 h-4 mr-2" />
                    {playingId === sound.id ? "Playing..." : "Play"}
                  </DungeonButton>
                  <DungeonButton variant={favorites.find(f => f.url === sound.url) ? "default" : "nav"} size="sm" onClick={() => toggleFavorite(sound)}>
                    <Star className="w-4 h-4" />
                  </DungeonButton>
                </div>
              </div>
            ))}
            {soundCardResults.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">No results</div>
            )}
          </div>
          {/* Upload button */}
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] || undefined)} />
            <DungeonButton variant="menu" className="flex items-center gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> Upload Sound
            </DungeonButton>
            <span className="text-xs text-muted-foreground">Upload will store files on Firebase Storage.</span>
          </div>
        </div>
        <div>
          <div className="mb-4">
            <h3 className="font-display text-sm text-primary mb-2">Recently Used</h3>
            <div className="space-y-2 bg-muted/10 p-2 max-h-56 overflow-y-auto">
              {recent.map((r) => (
                <div key={r.url} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-primary">{cleanSoundName(r.name)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DungeonButton size="sm" variant="default" onClick={() => handlePlayClick(r)}>
                      <Play className="w-4 h-4" />
                    </DungeonButton>
                    <DungeonButton size="sm" variant={favorites.find(f => f.url === r.url) ? "default" : "nav"} onClick={() => toggleFavorite(r)}>
                      <Star className="w-4 h-4" />
                    </DungeonButton>
                  </div>
                </div>
              ))}
              {recent.length === 0 && <div className="text-xs text-muted-foreground">No recent sounds</div>}
            </div>
          </div>
          <div>
            <h3 className="font-display text-sm text-primary mb-2">Favorites</h3>
            <div className="space-y-2 bg-muted/10 p-2 max-h-56 overflow-y-auto">
              {favorites.map((f) => (
                <div key={f.url} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-primary">{cleanSoundName(f.name)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DungeonButton size="sm" variant="default" onClick={() => handlePlayClick(f)}>
                      <Play className="w-4 h-4" />
                    </DungeonButton>
                    <DungeonButton size="sm" variant="danger" onClick={() => toggleFavorite(f)}>
                      Remove
                    </DungeonButton>
                  </div>
                </div>
              ))}
              {favorites.length === 0 && <div className="text-xs text-muted-foreground">No favorites</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SoundEffectsView;
