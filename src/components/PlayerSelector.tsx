import { useState } from "react";
import { motion } from "framer-motion";
import { DungeonButton } from "./ui/DungeonButton";
import { User, Brain, Users } from "lucide-react";
import { Crawler } from "@/lib/gameData";

interface PlayerSelectorProps {
  crawlers: Crawler[];
  onSelect: (playerId: string, playerName: string, playerType: "crawler" | "ai" | "npc") => void;
}

const PlayerSelector: React.FC<PlayerSelectorProps> = ({ crawlers, onSelect }) => {
  const [selectedPlayer, setSelectedPlayer] = useState("npc"); // Default to "Just a Boring NPC"
  const [selectedType, setSelectedType] = useState<"crawler" | "ai" | "npc">("npc");

  const handleSelect = () => {
    if (!selectedPlayer) return;

    let playerName = "";
    let type: "crawler" | "ai" | "npc" = "crawler";

    if (selectedPlayer === "dungeon-ai") {
      playerName = "Dungeon AI";
      type = "ai";
    } else if (selectedPlayer === "npc") {
      playerName = "Just a Boring NPC";
      type = "npc";
    } else {
      const crawler = crawlers.find(c => c.id === selectedPlayer);
      playerName = crawler?.name || "";
      type = "crawler";
    }

    onSelect(selectedPlayer, playerName, type);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-background border-2 border-primary p-6 max-w-md w-full mx-4"
    >
      <h2 className="font-display text-xl text-primary text-glow-cyan mb-4 text-center">
        SELECT YOUR IDENTITY
      </h2>

      <div className="space-y-4">
        <div>
          <label className="text-muted-foreground text-sm mb-2 block">Who are you?</label>
          <select
            value={selectedPlayer}
            onChange={(e) => {
              setSelectedPlayer(e.target.value);
              if (e.target.value === "dungeon-ai") setSelectedType("ai");
              else if (e.target.value === "npc") setSelectedType("npc");
              else setSelectedType("crawler");
            }}
            className="w-full bg-muted border border-primary px-4 py-3 text-foreground font-mono"
          >
            <option value="">-- Choose Your Identity --</option>
            <optgroup label="Crawlers">
              {crawlers.map((crawler) => (
                <option key={crawler.id} value={crawler.id}>
                  {crawler.name} (Lvl {crawler.level} {crawler.job})
                </option>
              ))}
            </optgroup>
            <optgroup label="Spectators">
              <option value="npc">Just a Boring NPC</option>
            </optgroup>
            <optgroup label="System Access">
              <option value="dungeon-ai">Dungeon AI (DM Access)</option>
            </optgroup>
          </select>
        </div>

        <DungeonButton
          variant="menu"
          className="w-full"
          onClick={handleSelect}
          disabled={!selectedPlayer}
        >
          {selectedType === "ai" && <Brain className="w-5 h-5 mr-2" />}
          {selectedType === "npc" && <Users className="w-5 h-5 mr-2" />}
          {selectedType === "crawler" && <User className="w-5 h-5 mr-2" />}
          Enter System
        </DungeonButton>
      </div>
    </motion.div>
  );
};

export default PlayerSelector;
