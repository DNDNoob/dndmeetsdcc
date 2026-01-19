import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Volume2, Search, Play, Star, Upload, Square } from "lucide-react";
import { useFirebaseStore } from "@/hooks/useFirebaseStore";
import { storage, db } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, onSnapshot, serverTimestamp, addDoc, Timestamp } from "firebase/firestore";

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
  const { getCollection, addItem, deleteItem, roomId } = useFirebaseStore();
  // Debug: Log current roomId
  useEffect(() => {
    console.log('[SoundEffectsView] Current roomId:', roomId);
  }, [roomId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SoundEffect[]>(LOCAL_SOUNDS);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recent, setRecent] = useState<SoundEffect[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
  });
  const mountTime = useRef(Timestamp.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    // Listen for sound broadcasts
    const broadcastCollectionName = roomId ? `rooms/${roomId}/sound-broadcast` : 'sound-broadcast';
    const q = query(collection(db, broadcastCollectionName), where('createdAt', '>', mountTime.current));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const sound = change.doc.data() as SoundEffect;
          console.log('[SoundEffectsView] Received sound broadcast:', sound, 'roomId:', roomId);
          playSoundLocal(sound, false);
        }
      });
    },
    (error) => {
      console.error('[SoundEffectsView] Firestore listener error:', error);
    });

    return () => unsubscribe();
  }, [roomId]);


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

      // Try custom API base first (for dev/local/proxy)
      const base = (import.meta.env.VITE_SOUND_API_BASE as string) || (import.meta.env.VITE_SOUND_SERVER_BASE as string) || '';
      if (base) {
        const url = `${base}/api/sounds/search?q=${encodeURIComponent(q)}&page=1&page_size=60`;
        try {
          const res = await fetch(url);
          if (!res.ok) {
            console.warn('search proxy failed', await res.text());
            // fallback to Freesound or local
            throw new Error('Proxy search failed');
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
          return;
        } catch (e) {
          // fall through to Freesound
        }
      }

      // If no custom API, use Freesound directly (browser fetch)
      if (FREESOUND_KEY) {
        const freesoundUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&fields=id,name,previews,tags&token=${FREESOUND_KEY}`;
        try {
          const res = await fetch(freesoundUrl);
          if (!res.ok) {
            console.warn('Freesound search failed', await res.text());
            throw new Error('Freesound search failed');
          }
          const json = await res.json();
          if (!active) return;
          const mapped: SoundEffect[] = (json.results || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            url: r.previews ? (r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'] || r.previews['preview-hq-ogg'] || r.previews['preview-lq-ogg']) : '',
            tags: r.tags || [],
            source: 'freesound'
          })).filter(s => s.url);
          setResults([...uploaded, ...mapped]);
          return;
        } catch (e) {
          console.error('Freesound search failed', e);
        }
      }

      // fallback to local
      if (active) setResults([...uploaded, ...LOCAL_SOUNDS]);
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
    // Stop any currently playing sound
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlayingId(sound.id);
    const audio = new Audio(sound.url);
    audioRef.current = audio;
    audio.play().catch((e) => console.warn("Failed to play", e));
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };

    // update recent
    setRecent((prev) => {
      const without = prev.filter((p) => p.url !== sound.url);
      return [sound, ...without].slice(0, 10);
    });

    if (broadcast) {
      broadcastSound(sound);
    }
  };

  const stopSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
  };

  const broadcastSound = async (sound: SoundEffect) => {
    const broadcastCollectionName = roomId ? `rooms/${roomId}/sound-broadcast` : 'sound-broadcast';
    try {
      console.log('[SoundEffectsView] Broadcasting sound:', sound, 'to collection:', broadcastCollectionName, 'roomId:', roomId);
      await addDoc(collection(db, broadcastCollectionName), {
        ...sound,
        createdAt: serverTimestamp()
      });
      console.log('[SoundEffectsView] Broadcast successful');
    } catch (error) {
      console.error('[SoundEffectsView] Failed to broadcast sound:', error);
    }
  };

  const handlePlayClick = (sound: SoundEffect) => {
    playSoundLocal(sound, true);
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
      {/* Debug: Show current roomId */}
      <div className="mb-2 text-xs text-muted-foreground">Current roomId: {roomId ? roomId : '(none)'}</div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Sound Effects Library</h1>
      </div>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sounds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 pl-10 pr-4 border-2 border-primary/20 rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-base"
          />
        </div>
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
                  {playingId === sound.id ? (
                    <DungeonButton variant="admin" size="sm" className="flex-1" onClick={stopSound}>
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </DungeonButton>
                  ) : (
                    <DungeonButton variant="default" size="sm" className="flex-1" onClick={() => handlePlayClick(sound)}>
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </DungeonButton>
                  )}
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
                    {playingId === r.id ? (
                      <DungeonButton size="sm" variant="admin" onClick={stopSound}>
                        <Square className="w-4 h-4" />
                      </DungeonButton>
                    ) : (
                      <DungeonButton size="sm" variant="default" onClick={() => handlePlayClick(r)}>
                        <Play className="w-4 h-4" />
                      </DungeonButton>
                    )}
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
                    {playingId === f.id ? (
                      <DungeonButton size="sm" variant="admin" onClick={stopSound}>
                        <Square className="w-4 h-4" />
                      </DungeonButton>
                    ) : (
                      <DungeonButton size="sm" variant="default" onClick={() => handlePlayClick(f)}>
                        <Play className="w-4 h-4" />
                      </DungeonButton>
                    )}
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
