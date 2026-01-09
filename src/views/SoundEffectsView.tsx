import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DungeonCard } from "@/components/ui/DungeonCard";
import { DungeonButton } from "@/components/ui/DungeonButton";
import { Volume2, Search, Play } from "lucide-react";

interface SoundEffect {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

const soundEffects: SoundEffect[] = [
  { id: "1", name: "Sword Slash", url: "https://assets.mixkit.co/active_storage/sfx/2792/2792.wav", tags: ["combat", "weapon", "sword"] },
  { id: "2", name: "Magic Spell", url: "https://assets.mixkit.co/active_storage/sfx/2566/2566.wav", tags: ["magic", "spell", "casting"] },
  { id: "3", name: "Door Creak", url: "https://assets.mixkit.co/active_storage/sfx/2403/2403.wav", tags: ["door", "spooky", "ambient"] },
  { id: "4", name: "Footsteps", url: "https://assets.mixkit.co/active_storage/sfx/2462/2462.wav", tags: ["movement", "steps", "walking"] },
  { id: "5", name: "Coin Drop", url: "https://assets.mixkit.co/active_storage/sfx/1997/1997.wav", tags: ["treasure", "gold", "money"] },
  { id: "6", name: "Monster Roar", url: "https://assets.mixkit.co/active_storage/sfx/2577/2577.wav", tags: ["monster", "creature", "scary"] },
  { id: "7", name: "Fire Blast", url: "https://assets.mixkit.co/active_storage/sfx/1579/1579.wav", tags: ["fire", "explosion", "magic"] },
  { id: "8", name: "Healing Sound", url: "https://assets.mixkit.co/active_storage/sfx/2017/2017.wav", tags: ["healing", "magic", "restoration"] },
  { id: "9", name: "Arrow Shot", url: "https://assets.mixkit.co/active_storage/sfx/1621/1621.wav", tags: ["arrow", "bow", "weapon"] },
  { id: "10", name: "Thunder", url: "https://assets.mixkit.co/active_storage/sfx/151/151.wav", tags: ["thunder", "weather", "storm"] },
  { id: "11", name: "Chest Open", url: "https://assets.mixkit.co/active_storage/sfx/2398/2398.wav", tags: ["treasure", "chest", "loot"] },
  { id: "12", name: "Level Up", url: "https://assets.mixkit.co/active_storage/sfx/2000/2000.wav", tags: ["achievement", "level", "success"] },
  { id: "13", name: "Shield Block", url: "https://assets.mixkit.co/active_storage/sfx/2786/2786.wav", tags: ["combat", "defense", "block"] },
  { id: "14", name: "Potion Drink", url: "https://assets.mixkit.co/active_storage/sfx/2022/2022.wav", tags: ["potion", "healing", "drink"] },
  { id: "15", name: "Teleport", url: "https://assets.mixkit.co/active_storage/sfx/2018/2018.wav", tags: ["magic", "teleport", "portal"] },
];

const SoundEffectsView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSounds, setFilteredSounds] = useState(soundEffects);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const filtered = soundEffects.filter((sound) => {
      const query = searchQuery.toLowerCase();
      return (
        sound.name.toLowerCase().includes(query) ||
        sound.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
    setFilteredSounds(filtered);
  }, [searchQuery]);

  const playSound = (sound: SoundEffect) => {
    setPlayingId(sound.id);
    const audio = new Audio(sound.url);
    audio.play();
    audio.onended = () => setPlayingId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto p-4 md:p-6"
    >
      <DungeonCard>
        <h2 className="font-display text-2xl text-primary text-glow-cyan mb-6 flex items-center gap-3">
          <Volume2 className="w-6 h-6" />
          SOUND EFFECTS LIBRARY
        </h2>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sound effects by name or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted border border-border pl-10 pr-4 py-3"
          />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSounds.map((sound) => (
            <div
              key={sound.id}
              className="border border-border bg-muted/20 p-4 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display text-foreground">{sound.name}</h3>
                <Volume2 className="w-4 h-4 text-primary" />
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {sound.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs bg-primary/10 text-primary px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <DungeonButton
                variant={playingId === sound.id ? "admin" : "default"}
                size="sm"
                className="w-full"
                onClick={() => playSound(sound)}
                disabled={playingId === sound.id}
              >
                <Play className="w-4 h-4 mr-2" />
                {playingId === sound.id ? "Playing..." : "Play Sound"}
              </DungeonButton>
            </div>
          ))}

          {filteredSounds.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No sound effects found matching "{searchQuery}"
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          Sound effects provided by Mixkit - Free for use
        </div>
      </DungeonCard>
    </motion.div>
  );
};

export default SoundEffectsView;
